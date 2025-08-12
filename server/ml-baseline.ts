/**
 * 📊 ML BASELINE SYSTEM  
 * StandardScaler + Classical ML support for Quantum-Guard fallbacks
 */

export class StandardScaler {
  private mean: number[] = [];
  private std: number[] = [];
  private fitted: boolean = false;

  fit(data: number[][]): void {
    if (data.length === 0) return;
    
    const numFeatures = data[0].length;
    this.mean = new Array(numFeatures).fill(0);
    this.std = new Array(numFeatures).fill(1);
    
    // Calculate means
    for (let i = 0; i < numFeatures; i++) {
      let sum = 0;
      for (let j = 0; j < data.length; j++) {
        sum += data[j][i];
      }
      this.mean[i] = sum / data.length;
    }
    
    // Calculate standard deviations
    for (let i = 0; i < numFeatures; i++) {
      let sumSquaredDiff = 0;
      for (let j = 0; j < data.length; j++) {
        sumSquaredDiff += Math.pow(data[j][i] - this.mean[i], 2);
      }
      this.std[i] = Math.sqrt(sumSquaredDiff / data.length);
      if (this.std[i] === 0) this.std[i] = 1; // Avoid division by zero
    }
    
    this.fitted = true;
  }

  transform(data: number[][]): number[][] {
    if (!this.fitted) {
      throw new Error('Scaler must be fitted before transforming data');
    }
    
    return data.map(row => 
      row.map((value, i) => (value - this.mean[i]) / this.std[i])
    );
  }

  fitTransform(data: number[][]): number[][] {
    this.fit(data);
    return this.transform(data);
  }

  isReady(): boolean {
    return this.fitted;
  }

  getParams() {
    return {
      mean: this.mean,
      std: this.std,
      fitted: this.fitted
    };
  }
}