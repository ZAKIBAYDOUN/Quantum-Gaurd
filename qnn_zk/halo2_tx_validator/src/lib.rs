// lib.rs
use halo2_proofs::{
    arithmetic::FieldExt,
    circuit::{Layouter, SimpleFloorPlanner, Value},
    plonk::{Advice, Circuit, Column, ConstraintSystem, Error, Instance, Selector},
};
use halo2_gadgets::poseidon::{Hash, Pow5Chip, Pow5Config};
use halo2_proofs::pairing::bn256::Fr;

const FRAC_BITS: u32 = 16;

fn sigmoid_poly(x: Fr) -> Fr {
    let scale = Fr::from(1u64 << FRAC_BITS);
    let c0 = Fr::from(((0.5f64 * (1u64<<FRAC_BITS) as f64).round()) as u64);
    let c1 = Fr::from(((0.25f64 * (1u64<<FRAC_BITS) as f64).round()) as u64);
    let c3 = Fr::from(((-0.0208333333333f64 * (1u64<<FRAC_BITS) as f64).round() as i64) as u64);

    let x1 = x;
    let x2 = x1 * x1;
    let x3 = x2 * x1;
    let term1 = (c1 * x1) * scale.invert().unwrap();
    let term3 = (c3 * x3) * (scale * scale).invert().unwrap();

    c0 + term1 + term3
}

#[derive(Clone, Debug)]
pub struct Config {
    adv: [Column<Advice>; 6],
    sel: Selector,
    poseidon: Pow5Config<Fr, 3, 2>,
    instance: [Column<Instance>; 3], // commit_wb, commit_q, score_pub
}

#[derive(Clone, Debug, Default)]
pub struct TxCircuit {
    pub x: Vec<Fr>,
    pub w: Vec<Fr>,
    pub b: Fr,
    pub alpha: Fr,
    pub q_out: Fr,
    pub score_pub: Fr,
}

impl Circuit<Fr> for TxCircuit {
    type Config = Config;
    type FloorPlanner = SimpleFloorPlanner;

    fn without_witnesses(&self) -> Self { Self::default() }

    fn configure(cs: &mut ConstraintSystem<Fr>) -> Self::Config {
        let adv = [0,1,2,3,4,5].map(|_| cs.advice_column());
        for a in &adv { cs.enable_equality(*a); }
        let instance = [0,1,2].map(|_| cs.instance_column());
        for i in &instance { cs.enable_equality(*i); }
        let sel = cs.selector();
        let poseidon = Pow5Chip::configure(cs, adv[0], adv[1], adv[2], adv[3], adv[4], adv[5]);

        cs.create_gate("score equals public", |meta| {
            let s = meta.query_selector(sel);
            let score_calc = meta.query_advice(adv[5], 0);
            let score_pub = meta.query_instance(instance[2], 0);
            vec![ s * (score_calc - score_pub) ]
        });

        Config { adv, sel, poseidon, instance }
    }

    fn synthesize(&self, cfg: Self::Config, mut layouter: impl Layouter<Fr>) -> Result<(), Error> {
        // Poseidon commits (dummy wiring para demo; publica cero por simplicidad)
        let _commit_wb = {
            let mut hasher = Hash::<Fr, Pow5Chip<Fr>, 3, 2>::init(cfg.poseidon.clone(), layouter.namespace(|| "poseidon_wb"))?;
            let mut inputs = self.w.clone();
            inputs.push(self.b);
            hasher.update(layouter.namespace(|| "absorb_wb"), inputs)?;
            hasher.squeeze(layouter.namespace(|| "squeeze_wb"))?
        };
        let _commit_q = {
            let mut hasher = Hash::<Fr, Pow5Chip<Fr>, 3, 2>::init(cfg.poseidon.clone(), layouter.namespace(|| "poseidon_q"))?;
            hasher.update(layouter.namespace(|| "absorb_q"), vec![self.q_out])?;
            hasher.squeeze(layouter.namespace(|| "squeeze_q"))?
        };

        // z = sum(w_i * x_i)/2^k + b + alpha*q_out/2^k
        let scale = Fr::from(1u64 << FRAC_BITS);

        let score_cell = layouter.assign_region(
            || "affine + sigmoid",
            |mut region| {
                cfg.sel.enable(&mut region, 0)?;
                let mut acc = Fr::from(0);
                for (i, (wi, xi)) in self.w.iter().zip(self.x.iter()).enumerate() {
                    acc += (*wi * *xi) * scale.invert().unwrap();
                    let _ = region.assign_advice(|| format!("w_{i}"), cfg.adv[1], i, || Value::known(*wi))?;
                    let _ = region.assign_advice(|| format!("x_{i}"), cfg.adv[0], i, || Value::known(*xi))?;
                }
                acc += self.b;
                acc += (self.alpha * self.q_out) * scale.invert().unwrap();

                let score = sigmoid_poly(acc);
                let score_cell = region.assign_advice(|| "score", cfg.adv[5], 0, || Value::known(score))?;
                Ok(score_cell)
            }
        )?;

        layouter.constrain_instance(score_cell.cell(), cfg.instance[2], 0)?;
        Ok(())
    }
}

pub fn fr_from_qi128(x: i128) -> Fr { Fr::from((x as i64) as u64) }
