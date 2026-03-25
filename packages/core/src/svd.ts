/**
 * One-sided Jacobi SVD for small matrices (primarily m×3 with m ≤ 8).
 *
 * Returns { U, S, V } where A ≈ U · diag(S) · V^T:
 *   - U  is m×k  (left singular vectors as columns)
 *   - S  is k    (singular values, sorted descending)
 *   - V  is n×k  (right singular vectors as columns)
 *   - k  = min(m, n)
 */
export function svd(A: number[][]): { U: number[][]; S: number[]; V: number[][] } {
  const m = A.length;
  const n = A[0].length;
  const k = Math.min(m, n);

  // --- Step 1: B = A^T · A  (n×n, symmetric positive semi-definite) ---
  // B[i][j] = sum_r A[r][i] * A[r][j]
  const B: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      let s = 0;
      for (let r = 0; r < m; r++) s += A[r][i] * A[r][j];
      return s;
    }),
  );

  // --- Step 2: Jacobi eigendecomposition of B ---
  // eigenvectors accumulated in V_full (n×n identity initially)
  const V_full: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  );

  const TOL = 1e-12;
  const MAX_ITER = 1000 * n * n;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    // Find largest off-diagonal element in B
    let maxVal = 0;
    let p = 0;
    let q = 1;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const v = Math.abs(B[i][j]);
        if (v > maxVal) {
          maxVal = v;
          p = i;
          q = j;
        }
      }
    }

    if (maxVal < TOL) break;

    // Compute Jacobi rotation angle for (p, q)
    // tan(2θ) = 2·B[p][q] / (B[p][p] - B[q][q])
    const Bpp = B[p][p];
    const Bqq = B[q][q];
    const Bpq = B[p][q];

    let c: number;
    let s: number;

    if (Math.abs(Bpp - Bqq) < 1e-15) {
      // 45-degree rotation
      c = Math.SQRT1_2;
      s = Math.SQRT1_2;
    } else {
      const tau = (Bqq - Bpp) / (2 * Bpq);
      const t = tau >= 0
        ? 1 / (tau + Math.sqrt(1 + tau * tau))
        : 1 / (tau - Math.sqrt(1 + tau * tau));
      c = 1 / Math.sqrt(1 + t * t);
      s = t * c;
    }

    // Apply rotation: B ← J^T · B · J
    // First update off-diagonal rows/cols, then diagonal
    const newBpp = c * c * Bpp - 2 * s * c * Bpq + s * s * Bqq;
    const newBqq = s * s * Bpp + 2 * s * c * Bpq + c * c * Bqq;

    B[p][p] = newBpp;
    B[q][q] = newBqq;
    B[p][q] = 0;
    B[q][p] = 0;

    for (let r = 0; r < n; r++) {
      if (r === p || r === q) continue;
      const Brp = B[r][p];
      const Brq = B[r][q];
      B[r][p] = c * Brp - s * Brq;
      B[p][r] = B[r][p];
      B[r][q] = s * Brp + c * Brq;
      B[q][r] = B[r][q];
    }

    // Accumulate rotation into V_full
    for (let r = 0; r < n; r++) {
      const Vrp = V_full[r][p];
      const Vrq = V_full[r][q];
      V_full[r][p] = c * Vrp - s * Vrq;
      V_full[r][q] = s * Vrp + c * Vrq;
    }
  }

  // --- Step 3: Extract eigenvalues (diagonal of B) and sort descending ---
  // Clamp small negatives from floating-point errors to 0
  const indices = Array.from({ length: n }, (_, i) => i);
  indices.sort((a, b) => Math.max(0, B[b][b]) - Math.max(0, B[a][a]));

  const eigenvalues = indices.map(i => Math.max(0, B[i][i]));
  const S_full = eigenvalues.map(ev => Math.sqrt(ev));

  // Reorder V columns
  const V_sorted: number[][] = Array.from({ length: n }, (_, row) =>
    indices.map(col => V_full[row][col]),
  );

  // --- Step 4: Compute U = A · V · diag(1/S) for k columns ---
  // U is m×k; only produce columns for the k smallest-index singular values
  const U: number[][] = Array.from({ length: m }, () => new Array(k).fill(0));

  for (let col = 0; col < k; col++) {
    const sv = S_full[col];
    if (sv < 1e-12) {
      // Zero singular value — leave U column as zeros
      continue;
    }
    // U[:,col] = A · V_sorted[:,col] / sv
    for (let row = 0; row < m; row++) {
      let sum = 0;
      for (let j = 0; j < n; j++) {
        sum += A[row][j] * V_sorted[j][col];
      }
      U[row][col] = sum / sv;
    }
  }

  // Slice S and V to k columns (when n > k there would be extra, but n=3 always, so k ≤ n)
  const S = S_full.slice(0, k);
  const V: number[][] = Array.from({ length: n }, (_, row) =>
    V_sorted[row].slice(0, k),
  );

  return { U, S, V };
}
