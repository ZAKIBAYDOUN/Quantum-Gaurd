// main.rs
use clap::{Parser, Subcommand};
use halo2_proofs::{
    dev::MockProver,
    plonk::{keygen_pk, keygen_vk},
    poly::kzg::{
        commitment::ParamsKZG,
        multiopen::{ProverGWC, VerifierGWC},
        strategy::SingleStrategy,
    },
    transcript::{Blake2bWrite, Blake2bRead, Challenge255},
    pairing::bn256::{Bn256, Fr},
};
use halo2_tx_validator::{TxCircuit, fr_from_qi128};
use serde::{Deserialize, Serialize};
use std::{fs, path::Path};

#[derive(Parser)]
#[command(author, version, about)]
struct Cli { #[command(subcommand)] cmd: Cmd }

#[derive(Subcommand)]
enum Cmd {
    GenParams { #[arg(long)] k: u32, #[arg(long)] out: String },
    Prove {
        #[arg(long)] params: String,
        #[arg(long)] witness: String,
        #[arg(long)] proof: String,
        #[arg(long)] public: String
    },
    Verify {
        #[arg(long)] params: String,
        #[arg(long)] proof: String,
        #[arg(long)] public: String
    },
}

#[derive(Deserialize)]
struct Witness {
    x: Vec<i64>, w: Vec<i64>, b: i64, alpha: i64, q_out: i64, score_pub: i64,
}
#[derive(Serialize, Deserialize)]
struct Public {
    commit_wb: String, commit_q: String, score_pub: String,
    instances: Vec<Vec<Fr>>,
}

fn to_fr_q16(v: i64) -> Fr { fr_from_qi128(v as i128) }

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();
    match cli.cmd {
        Cmd::GenParams { k, out } => {
            let params = ParamsKZG::<Bn256>::setup(k, rand::thread_rng());
            fs::write(out, params.to_bytes())?;
            println!("Params KZG generados.");
        }
        Cmd::Prove { params, witness, proof, public } => {
            let params_bytes = fs::read(params)?;
            let params = ParamsKZG::<Bn256>::read(&mut &params_bytes[..]).unwrap();

            let wit: Witness = serde_json::from_str(&fs::read_to_string(&witness)?)?;
            let circ = TxCircuit {
                x: wit.x.into_iter().map(to_fr_q16).collect(),
                w: wit.w.into_iter().map(to_fr_q16).collect(),
                b: to_fr_q16(wit.b),
                alpha: to_fr_q16(wit.alpha),
                q_out: to_fr_q16(wit.q_out),
                score_pub: to_fr_q16(wit.score_pub),
            };

            let vk = keygen_vk(&params, &circ)?;
            let pk = keygen_pk(&params, vk, &circ)?;

            // Públicos simplificados: solo score_pub
            let instances: Vec<Vec<Fr>> = vec![ vec![Fr::from(0)], vec![Fr::from(0)], vec![to_fr_q16(wit.score_pub)] ];

            let mut transcript = Blake2bWrite::<_, _, Challenge255<_>>::init(vec![]);
            halo2_proofs::plonk::create_proof::<
                halo2_proofs::poly::kzg::commitment::KZGCommitmentScheme<Bn256>,
                ProverGWC<_>, _, _, _, _
            >(&params, &pk, &[circ], &[&instances], rand::thread_rng(), &mut transcript)?;
            let proof_bytes = transcript.finalize();
            fs::write(&proof, &proof_bytes)?;

            let pub_json = Public {
                commit_wb: "0x00".into(),
                commit_q: "0x00".into(),
                score_pub: format!("{:?}", to_fr_q16(wit.score_pub)),
                instances,
            };
            fs::write(&public, serde_json::to_vec_pretty(&pub_json)?)?;
            println!("Prueba creada.");
        }
        Cmd::Verify { params, proof, public } => {
            let params_bytes = fs::read(params)?;
            let params = ParamsKZG::<Bn256>::read(&mut &params_bytes[..]).unwrap();
            let proof_bytes = fs::read(proof)?;
            let pub_json: Public = serde_json::from_slice(&fs::read(public)?)?;
            let mut transcript = Blake2bRead::<_, _, Challenge255<_>>::init(&proof_bytes[..]);
            let strategy = SingleStrategy::<halo2_proofs::poly::kzg::commitment::KZGCommitmentScheme<Bn256>>::new(&params);
            halo2_proofs::plonk::verify_proof::<
                halo2_proofs::poly::kzg::commitment::KZGCommitmentScheme<Bn256>,
                VerifierGWC<_>, _, _
            >(&params, &[], strategy, &[&pub_json.instances], &mut transcript)?;
            println!("¡Prueba verificada!");
        }
    }
    Ok(())
}
