# Perceptual Color Palette Generation via Particle Repulsion on Convex Hulls in Warped OKLab Space

## Version 4.4 — Final Revision

---

## 1. Problem Statement

Given a small set of user-defined seed colors (typically 2–8), generate an expanded palette of N colors (typically 5–20) that:

- Are **perceptually distinct** from each other, with emphasis on worst-case distinguishability
- Remain **within the chromatic family** defined by the seeds
- Avoid muddy, desaturated colors **unless the seeds themselves are muted**
- Require no manual intervention beyond choosing the seeds, the desired palette size, and a single creative parameter
- Adapt automatically to any seed configuration (vivid, muted, wrapping around the hue wheel, clustered, sparse)

### 1.1 Preconditions

The algorithm requires at least **2 distinct seed colors** and a requested palette size **N ≥ number of distinct seeds**. Every seed appears in the output as a pinned particle, so requesting fewer colors than seeds is a contradiction.

The following cases are explicitly not handled and must be rejected at input:

- **1 seed:** A single point defines no interpolation space. Palette generation from a single color is a fundamentally different problem (monochromatic variation) and is out of scope.
- **All seeds identical (or within a ΔE threshold):** The convex hull is degenerate (a point). Reject with an error indicating that seeds must be distinct.
- **All seeds collinear after accounting for the 2-seed case:** Handled as a 2-seed problem (see Section 3.2.1).
- **N < number of distinct seeds:** Reject. The palette cannot contain fewer colors than seeds.

---

## 2. Color Space: OKLab

All computation occurs in the OKLab perceptual color space, using Cartesian coordinates:

- **L** ∈ [0, 1]: perceptual lightness
- **a** ∈ [−0.5, +0.5]: green–red opponent axis
- **b** ∈ [−0.5, +0.5]: blue–yellow opponent axis

Derived polar quantities:

- **Chroma:** r = √(a² + b²), the radial distance from the neutral axis
- **Hue:** θ = atan2(b, a)

The neutral gray axis is the L axis (a = 0, b = 0). Euclidean distance in OKLab approximates perceived color difference for small to moderate distances.

**Why OKLab and not another space:** OKLab is computationally simple (two matrix multiplications and a cube root), has an analytical inverse, predicts hue uniformity well, and is now a CSS/web standard. It is not perfectly uniform — no color space is — but it offers the best trade-off between accuracy and simplicity for this application. A 2022 PNAS study (Bujack et al.) shows that large perceptual distances exhibit "diminishing returns," meaning perceptual color space is not truly Riemannian. Our warped transform, designed for a different purpose, may partially account for this effect, though we treat it as an engineering approximation rather than a perceptual model.

---

## 3. Geometric Primitive: Seed Geometry and Dimensionality

The algorithm adapts its behavior based on the dimensionality of the seed configuration. The full 2D surface algorithm (Sections 4–8) applies to the 3+ non-collinear seed case. Lower-dimensional cases are handled as specializations.

### 3.1 Dimensionality Detection

Given the seed points in OKLab, compute the singular values (σ_1 ≥ σ_2 ≥ σ_3) of the mean-centered seed matrix. The affine dimension is determined by the number of singular values above a tolerance threshold τ_dim:

- **0D (all identical):** All σ < τ_dim. Rejected (see Section 1.1).
- **1D (2 seeds, or 3+ collinear seeds):** σ_1 ≥ τ_dim, σ_2 < τ_dim. Line segment case (Section 3.2.1).
- **2D (3+ coplanar seeds):** σ_1, σ_2 ≥ τ_dim, σ_3 < τ_dim. Flat hull case (Section 3.2.2).
- **3D (4+ non-coplanar seeds):** All σ ≥ τ_dim. Full hull case (Section 3.3).

The threshold τ_dim should be set relative to σ_1 — for example, τ_dim = 1e-4 · σ_1. This catches near-degenerate configurations where the hull would be technically 3D but numerically fragile: normals, local bases, and edge transition rotations computed from near-parallel vectors produce catastrophic floating point error. Collapsing such cases to the lower-dimensional pipeline is safer than attempting to operate on a sliver hull.

### 3.1.1 Seed Classification: Hull Vertices, Boundary Seeds, and Interior Seeds

Not every seed is necessarily a vertex of the convex hull. A user can provide a seed that lies on a hull face or edge without being a vertex, or one that lies strictly inside the hull. After computing the convex hull, classify each seed into one of three categories:

**Hull-vertex seeds:** seeds that are vertices of the convex hull. These are the natural anchors of the face atlas and are pinned at their vertex positions on the hull surface.

**Boundary seeds:** seeds that lie on the hull surface but are not vertices — specifically, on the interior of a face or on an edge between two faces. This occurs when a seed is a convex combination of 2 or 3 other seeds that are hull vertices, and lies exactly on the face or edge they define. For example, four seeds where one is the midpoint of a triangle formed by the other three.

Detection: for each non-vertex seed, test whether it lies on any hull face by computing barycentric coordinates relative to each face. The seed is on the face if all barycentric coordinates are in [0, 1] within a tolerance, and the distance to the face plane is below a threshold. If it lies on an edge, it will test positive for two adjacent faces — assign it to either one.

Policy: boundary seeds are **pinned on-surface particles**. They are assigned to their containing face with fixed barycentric coordinates. They exert repulsive force on all other particles but do not move. They participate in the face atlas naturally — they occupy a fixed position within a face, just as a hull-vertex seed occupies a fixed position at a vertex.

**Interior seeds:** seeds that lie strictly inside the convex hull (or, for 2D cases, inside the convex polygon; for 1D cases, between the endpoints). These are not on the hull surface.

Policy: interior seeds are retained as **pinned off-surface particles**. They remain at their fixed OKLab position, exert repulsive force on all other particles (surface-bound and pinned alike), but do not move. They participate fully in the energy computation — surface-bound particles repel from them using warped distance — but they are not constrained to the hull surface.

This three-way classification covers all possible seed positions: on a vertex, on a face or edge, or in the interior. All seeds are fixed; the only difference is where they live relative to the hull surface. All pinned seeds create a "shadow" in the energy landscape — nearby movable particles are pushed away, leaving room around each seed in the palette.

**Consequence for the 1D case:** already handled. The 1D section (Section 3.2.1) explicitly states that intermediate collinear seeds act as additional pinned particles along the segment (these are the 1D analog of boundary seeds).

**Consequence for family membership:** boundary and interior seeds are, by definition, convex combinations of the hull vertices. They are already within the chromatic family. Their presence in the output does not violate the family constraint — they strengthen it by anchoring the palette's character at intermediate positions.

### 3.2 Lower-Dimensional Cases

#### 3.2.1 Line Segment (1D): 2 Seeds or Collinear Seeds

The convex hull of collinear seeds is a line segment between the two extreme points. This is a 1D structure — no surface, no faces, no atlas.

**Handling:** The problem reduces to 1D particle repulsion along the segment. The two endpoint seeds are pinned. Remaining particles are distributed along the segment with repulsive forces computed using the warped distance applied to the segment's OKLab positions.

The warped transform still applies: if the segment crosses through the low-chroma region (e.g., connecting a warm color to a cool color through gray), particles bunch toward the high-chroma ends of the segment. If the segment stays at high chroma (e.g., two vivid colors of similar hue), particles distribute approximately uniformly.

Initialization is trivial: place particles at equal parametric intervals along the segment. The 1D case is much better behaved than the surface case and typically converges reliably.

For 3+ collinear seeds, intermediate seeds act as additional pinned particles along the same segment.

#### 3.2.2 Flat Hull (2D): 3+ Coplanar Seeds

With exactly 3 seeds, or with more seeds that happen to be coplanar, the convex hull degenerates to a flat convex polygon (a single triangle for 3 seeds, a convex polygon for more). This is a 2D object embedded in 3D space — it has no volume and no "inside" vs. "outside" faces.

**This case is fully supported by the main algorithm.** The hull surface is the polygon itself:

- **3 seeds:** One triangular face. The atlas has one entry, no edge transitions are needed, and particles move in 2D within the triangle with boundary clamping.
- **4+ coplanar seeds:** The convex polygon is triangulated into multiple faces. Standard atlas logic applies with edge transitions between internal edges and boundary clamping at polygon edges.

Both sides of the flat polygon are the same surface — there is no front/back distinction.

#### 3.2.3 Coplanar Seeds Along the Gray Axis

A particularly important coplanar case: seeds that lie on or very near the neutral axis (a ≈ 0, b ≈ 0), differing only in lightness plus small chromatic variation. For example, seeds at (0.2, 0.01, −0.01), (0.5, 0.02, 0.01), and (0.8, −0.01, 0.02).

The hull is a thin triangle nearly aligned with the L axis. In warped space, the chromatic dimensions of this triangle are heavily contracted. Particles distribute primarily by lightness, producing a near-monochromatic palette with very subtle chromatic variation. This is **correct behavior** — the seeds define a near-achromatic family, and the palette respects that.

If all seeds lie exactly on the L axis (zero chroma), the configuration is collinear and handled as a line segment (Section 3.2.1).

#### 3.2.4 Near-Degenerate Hulls

Seeds that are nearly coplanar (σ_3 just above τ_dim) or that produce faces with very small area require explicit numerical care:

**Face area threshold:** During atlas construction, compute the area of each face. Faces with area below a threshold τ_face (e.g., 1e-8) are flagged as degenerate. Their local bases are not computed (they would be numerically unreliable), they are excluded from particle initialization, and any particle that migrates onto them via edge crossing is pushed back to the originating face.

**Edge transition stability:** Dihedral angle computation for edge transitions involves the cross product of face normals. When adjacent faces are nearly coplanar (dihedral angle near 0° or 180°), the transition transform is near-identity and numerically stable. When a face is a sliver, its normal is unstable — this is caught by the face area threshold above.

The dimensionality detection (Section 3.1) catches the most extreme cases by collapsing them to lower-dimensional pipelines. The face-level thresholds handle faces that are individually degenerate within an otherwise valid 3D hull. Together, these ensure that the algorithm degrades gracefully rather than producing garbage from floating point noise.

### 3.3 Full Hull (3D): The General Case

For 4+ non-coplanar seeds (σ_3 ≥ τ_dim), the convex hull is a closed polyhedron with triangular faces, edges, and a well-defined interior. This is the primary case for which the full algorithm is designed.

### 3.4 Why the Surface, Not the Volume

Particles are constrained to the **surface** of the hull (or, in lower-dimensional cases, to the line segment or flat polygon), not its interior. This is a **deliberate aesthetic prior** — a bias toward expressive boundary colors — not a mathematically necessary consequence of palette quality.

**Geometric argument:** Interior points of a convex hull are weighted averages of all vertices. In OKLab, this means they are blends that pull toward the centroid of the seeds. The centroid is almost always lower in chroma than any individual seed. Interior colors are by definition less distinctive — they are compromises, not statements.

**Palette argument:** A palette is a set of distinct, identifiable colors sharing a family relationship. Surface points are interpolations of at most 3 seeds (the vertices of the face they occupy). Interior points average more seeds, diluting chromatic character. The seeds define the boundary of the palette's character. Colors inside that boundary are tamer versions of what is already represented.

**Adaptivity argument:** If muted colors are desired, the user provides muted seeds. The hull surface of muted seeds yields muted results. The surface constraint does not prevent muted palettes — it prevents palettes that are muddier than the seeds warrant.

Some valid palette colors may live in the hull interior. This method excludes them by construction. This is an intentional trade-off: we accept a more constrained solution space in exchange for consistently expressive results.

### 3.5 Self-Adapting Topology

The hull geometry, combined with the warped transform described in Section 4, produces different palette structures depending on seed placement:

- **Seeds on one side of the hue wheel:** Back faces cross through gray, become strongly disfavored. Particles concentrate on the vivid faces, producing an open-shell distribution.
- **Seeds wrapping around the hue wheel:** No face needs to cross gray. The full hull surface is usable.
- **Elongated seed configurations:** Particles spread along the dominant axis.
- **Clustered seeds:** The hull is small; particles pack tightly, producing a closely related palette.
- **All muted seeds:** The entire hull lives at low chroma. The warped transform has minimal effect (r_s is small relative to seed chromas). Particles distribute using whatever separation the hull offers.

This adaptation is automatic and requires no topology surgery (face culling, alternative triangulations, or manual connectivity).

---

## 4. The Warped Transform

### 4.1 Motivation

The convex hull surface inevitably includes faces that pass through or near the neutral gray core (a ≈ 0, b ≈ 0). Naive Euclidean distance treats these regions normally, allowing particles to settle there. We want a coordinate transform that contracts the low-chroma region, so that particles near gray appear crowded and are pushed outward by repulsive forces.

### 4.2 The Warping Function

We define a radial warping function f(r) that maps chroma r to a contracted value:

$$f(r) = \frac{r^2}{r + r_s}$$

where r_s > 0 is the single free parameter (the "gray avoidance radius").

**Properties of f(r):**

| Property | Value | Significance |
|----------|-------|--------------|
| f(0) | 0 | Gray maps to the origin |
| f'(0) | 0 | Radial distances contract at gray |
| f(r) for r >> r_s | ≈ r | Recovers Euclidean behavior at high chroma |
| f(r_s) | r_s/2 | At the threshold, chroma is halved |
| f'(r_s) | 3/4 | Smooth transition, no discontinuity |

The condition f'(0) = 0 is critical. It ensures that both radial (chroma) and tangential (hue) distances contract to zero near gray. Without it — for example, using the simpler f(r) = r/(r + r_s), which has f'(0) = 1/r_s — radial distances near gray are amplified rather than contracted, creating the opposite of the intended effect.

### 4.3 The Coordinate Transform

The warping is applied as a global coordinate transformation on the chromatic plane, leaving lightness unchanged:

Given a point p = (L, a, b) in OKLab with r = √(a² + b²):

$$T(L, a, b) = \left(L,\; \frac{f(r)}{r} \cdot a,\; \frac{f(r)}{r} \cdot b\right)$$

Since f(r)/r = r/(r + r_s), the transformed coordinates are:

- L' = L
- a' = a · r / (r + r_s)
- b' = b · r / (r + r_s)

And the warped chroma is:

$$r' = f(r) = \frac{r^2}{r + r_s}$$

**At r = 0:** the transform maps any gray point (L, 0, 0) to (L, 0, 0). The gray axis collapses chromatically to the L-axis in warped space — but **not** to a single point. Points at different lightness values remain separated by their L difference.

### 4.4 This Is a Coordinate Transform, Not a Metric

We define a global coordinate transformation T and compute Euclidean distance in the transformed space:

$$d_{\text{warped}}(p_1, p_2) = \|T(p_1) - T(p_2)\|_2$$

This is consistent, fast (no geodesic integration), and symmetric. It is not a true Riemannian geodesic distance — it is a transformed Euclidean distance. For our application (comparing discrete particle positions for repulsion), this is sufficient and preferable. We make no claims about path lengths or geodesics, only about pairwise distances between transformed positions.

### 4.5 Jacobian Verification

To confirm that the transform contracts all directions near gray, we examine its Jacobian in polar coordinates (r, θ) on the chromatic plane:

**Radial scaling:**

$$\frac{\partial r'}{\partial r} = \frac{r(r + 2r_s)}{(r + r_s)^2}$$

At r = 0: ∂r'/∂r = 0. Radial distances contract. ✓

At r >> r_s: ∂r'/∂r → 1. Euclidean recovery. ✓

**Tangential scaling:**

$$\frac{r'}{r} = \frac{r}{r + r_s}$$

At r = 0: r'/r = 0. Tangential (hue) distances contract. ✓

At r >> r_s: r'/r → 1. Euclidean recovery. ✓

Both components vanish at gray, confirming that the low-chroma region contracts in all chromatic directions in warped space. Two particles near gray with slightly different hue or chroma appear very close together — high repulsive energy — and are pushed toward higher chroma where they can separate more effectively.

### 4.6 Lightness Is Intentionally Untouched

Because L is unwarped, particles at different lightness values along the gray axis remain well-separated in warped space. Low-chroma positions are **strongly disfavored** but not absolutely forbidden. A particle can occupy a low-chroma position if it has sufficient lightness separation from all other particles. Whether this occurs depends on the hull geometry and the overall energy landscape.

We deliberately do not warp L because:

- A light gray and a dark gray are genuinely different, perceptually distinct colors — they should remain separable
- Warping L by a chroma-dependent factor would distort lightness relationships throughout the space, affecting high-chroma colors as well
- The hull surface itself acts as an adaptive chroma constraint: if all seeds are muted, the hull lives in low-chroma territory and particles have nowhere else to go, correctly producing a muted palette

The natural asymmetry helps: low-chroma particles compete for separation using only one dimension (L), while high-chroma particles have all three dimensions available. The energy landscape inherently favors high-chroma positions, which offer more room — but this is a preference, not a prohibition.

### 4.7 Choice of r_s

The parameter r_s determines the chroma scale below which warping is significant. It should adapt to the seed configuration.

**Rule:** Use the **median seed chroma** with floor and ceiling clamps:

$$r_s = \text{clamp}\left(\alpha \cdot \text{median}_i(\text{chroma}(seed_i)),\; r_{s,\text{min}},\; r_{s,\text{max}}\right)$$

with α ∈ (0.3, 0.5), r_{s,min} = 0.005, r_{s,max} = 0.10.

**Why median rather than minimum:** A single intentionally muted seed (e.g., a warm gray anchor among vivid seeds) should not weaken gray avoidance for the entire palette. The median is robust to one or two outlier seeds while still reflecting the palette's overall chroma character.

**Behavior:**

- For vivid seeds (median chroma ≈ 0.15): r_s ≈ 0.05–0.08, warping kicks in well below the palette's natural chroma range
- For muted seeds (median chroma ≈ 0.04): r_s ≈ 0.01–0.02, warping is gentle, the palette stays muted
- Floor clamp prevents numerical degeneracy for extremely muted seeds
- Ceiling clamp prevents excessive warping that could distort high-chroma relationships

r_s can also be exposed to the user as a "vividness" slider, overriding the automatic rule.

### 4.8 Exact-Gray Limitation

Because f'(0) = 0 and the chromatic block of J_T is zero at r = 0 (Section 8.1.1), a movable particle sitting at exactly zero chroma receives no chromatic gradient. It is a degenerate stationary point that a gradient-based optimizer cannot escape from because the gradient is exactly zero in the chromatic directions.

This means gray avoidance is truly a **soft preference**, not a hard rejection. In most configurations, particles never reach exact zero chroma because they are initialized away from it and the contracting warped space pushes them outward well before reaching r = 0. But in symmetric configurations — particularly a 1D gray-crossing segment with a particle initialized exactly at the midpoint — the symmetry of the repulsive forces can hold a particle at r = 0 indefinitely.

**Mitigation:** during initialization, apply a fixed perturbation to any particle whose initial position has chroma below a threshold (e.g., r < 1e-6). The perturbation must respect the constraint manifold — it cannot move the particle off the feasible domain:

- **1D case (line segment):** perturb the scalar parameter t by a fixed offset (e.g., +1e-5). This shifts the particle slightly along the segment without leaving it.
- **2D/3D surface case:** perturb in the particle's local face tangent plane. Compute the projection of the +a direction in OKLab onto the local tangent plane of the particle's face. If this projection is non-negligible (magnitude > 1e-8), use it as the perturbation direction. Otherwise (the face tangent plane is nearly perpendicular to +a), use the face's local e_1 basis vector instead. Apply with magnitude ~1e-5 in local coordinates. To avoid systematic hue bias, alternate the sign of the perturbation based on particle index (even index: positive, odd index: negative).

The jitter is smaller than any perceptible color difference and has no effect on particles that are already at non-zero chroma. The algorithm is fully deterministic — there is no randomness anywhere in the pipeline.

---

## 5. Energy Function

### 5.1 Riesz Energy with Steep Exponent and Continuation

Standard Coulomb (1/r) energy optimizes average spacing rather than worst-case distinguishability. For palettes, a pair of near-identical colors is more problematic than a slight imbalance in global distribution.

We use a Riesz energy with exponent p:

$$E_{\text{repulsion}} = \sum_{i < j} \frac{1}{d_{\text{warped}}(p_i, p_j)^p}$$

where p controls the balance between local packing and global distribution:

- p = 2: Moderate emphasis on close pairs. Smooth landscape, good for exploration.
- p = 4: Strong emphasis on close pairs. Intermediate.
- p = 6: Overwhelmingly dominated by closest pair. Approximates maximin while remaining smooth.
- p → ∞: Pure maximin (maximize minimum distance). Non-smooth, hard to optimize.

**We use continuation in p:** start the optimization at p = 2 for global exploration on a smooth energy landscape, then ramp to p = 6 over the course of optimization. This reduces stiffness in the early phase (where the p = 6 landscape can trap particles in local minima) and sharpens focus on worst-case spacing in the refinement phase. The ramp schedule follows a similar annealing pattern as the step size.

### 5.2 Gamut-Aware Penalty

The hull surface may extend outside the displayable sRGB gamut, particularly in high-chroma regions at certain hues (saturated cyans, deep blues). Post-optimization clipping destroys the optimized spacing. Instead, we incorporate gamut awareness into the energy function.

**The penalty operates directly in linear RGB space.** For each particle position in OKLab, convert to linear RGB (R, G, B) using the standard OKLab → linear sRGB matrix. Then for each channel c ∈ {R, G, B}:

$$E_{\text{gamut}} = \kappa \sum_i \sum_{c \in \{R,G,B\}} \left[\max(0, -c_i)^2 + \max(0, c_i - 1)^2\right]$$

This penalizes channels below 0 or above 1 with a smooth quadratic ramp. The function is:

- Exactly zero for in-gamut points (all channels in [0, 1])
- C¹ continuous at the gamut boundary (continuous first derivative)
- Analytically differentiable everywhere
- Cheap to compute — no gamut mapping routine, just channel clamping math

The gradient of E_gamut with respect to OKLab coordinates is obtained by composing the per-channel penalty gradient with the Jacobian of the OKLab → linear RGB conversion. This Jacobian is **not** a constant matrix: the inverse OKLab transform involves a nonlinear cubic stage (cubing the intermediate LMS values), so the Jacobian depends on the current point. Specifically:

$$J_{\text{RGB} \leftarrow \text{OKLab}}(L, a, b) = M_2 \cdot \text{diag}(3\hat{l}^2,\; 3\hat{m}^2,\; 3\hat{s}^2) \cdot M_1$$

where $(\hat{l}, \hat{m}, \hat{s}) = M_1 \cdot (L, a, b)$ are the intermediate post-matrix, pre-cube values, $M_1$ is the OKLab → LMS matrix, and $M_2$ is the LMS → linear RGB matrix. Both matrices are constant; the diagonal matrix varies per point. The Jacobian must be recomputed for each particle at each iteration, but this is cheap — two matrix lookups and three squarings.

This formulation avoids the complexity of differentiating through a Bottosson-style gamut mapping routine, which involves ray-gamut boundary intersection and is not trivially smooth.

### 5.3 Total Energy

$$E = E_{\text{repulsion}} + E_{\text{gamut}}$$

Both terms are differentiable in the unconstrained OKLab variables. E_repulsion is smooth because the Riesz potential 1/d^p is analytic for d > 0 (and particles never coincide due to the repulsion). E_gamut is C¹ continuous everywhere and C^∞ except at channel boundaries 0 and 1.

However, the **constrained** problem — particles moving on a polyhedral hull surface with face transitions and boundary clamping — is **piecewise smooth**, not globally smooth. The energy is smooth within each face, but face transitions introduce non-smooth boundaries in the parameter space. This is not a flaw: gradient-based optimization works well on piecewise smooth problems of this kind, and the face transitions are handled explicitly by the atlas rather than creating implicit discontinuities. But the overall constrained optimization should be understood as piecewise smooth gradient descent, not smooth gradient descent.

---

## 6. Movement Model: Face Atlas with Edge Transitions

### 6.1 Why Face Atlas

We evaluated four approaches for constraining particle movement to the hull surface:

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| 3D project-back | Simple | Oscillation at sharp edges, wrong-face projection | Rejected |
| Sphere remapping | Easy projection (normalize) | Jacobian issues, optimization-within-optimization | Rejected |
| Log-sum-exp smoothing | Smooth everywhere, no edges | Extra parameter β, annealing schedule, approximation | Viable but complex |
| Face atlas | Exact, no parameters, debuggable | Edge-crossing bookkeeping | **Selected** |

The face atlas is preferred because it is exact (no smoothing approximation), has no hidden parameters, and is a well-understood technique used extensively in game engine navmesh pathfinding.

### 6.2 Construction

For each triangular face F_k with 3D vertices (V_0, V_1, V_2) in OKLab, and whose area exceeds the face area threshold τ_face:

**Local 2D basis:**
- e_1 = normalize(V_1 − V_0)
- n = normalize((V_1 − V_0) × (V_2 − V_0))
- e_2 = n × e_1
- Origin: V_0

Any point on the face is represented as (u, v) where the 3D position is V_0 + u·e_1 + v·e_2.

**Edge transition transforms:** For each edge shared by two non-degenerate faces F_k and F_m, precompute the 2D affine transform M_{k→m} that maps F_k's local coordinates to F_m's local coordinates, aligned along the shared edge. This is a rotation by the dihedral angle plus a translation. Computed once at initialization from the hull geometry.

**Boundary edges (2D flat hull case):** Edges on the polygon boundary have no adjacent face. Particles reaching a boundary edge are clamped to the edge — they slide along it but cannot cross.

**Degenerate face edges:** Edges bordering a degenerate face (area < τ_face) are treated as boundary edges. Particles cannot cross into degenerate faces.

### 6.3 Particle State

Each particle stores:
- Face ID (which triangle it occupies)
- Local coordinates (u, v) within that face
- Equivalently, barycentric coordinates (λ_0, λ_1, λ_2) with λ_i ≥ 0, Σλ_i = 1

The 3D OKLab position is recovered by: P = λ_0·V_0 + λ_1·V_1 + λ_2·V_2.

### 6.4 Edge Crossing Logic

After applying a 2D displacement in local coordinates:

1. Recompute barycentric coordinates
2. If all λ_i ≥ 0: particle remains on the same face. Done.
3. If any λ_i < 0: particle has exited through the edge opposite vertex i
   - **Internal edge (adjacent to a non-degenerate face):** Identify the adjacent face. Apply the precomputed transition transform M_{k→m}. Subtract the displacement consumed reaching the edge. Continue the remaining displacement in the new face's frame. Recurse if the particle crosses another edge (rare for small steps).
   - **Boundary edge or degenerate-face edge:** Project the displacement onto the edge direction. The particle slides along the boundary but does not leave the mesh.

**Degenerate cases:** particle exactly on a vertex (shared by multiple faces) — assign to any adjacent non-degenerate face, any consistent tie-breaking rule suffices. Particle trajectory exactly along an edge — assign to either adjacent face. These are measure-zero events.

### 6.5 Specialization for Lower Dimensions

- **Line segment (2 seeds):** No atlas. Particles have a single scalar parameter t ∈ [0, 1] along the segment. Displacement is 1D. Boundary clamping at t = 0 and t = 1.
- **Single triangle (3 seeds):** Atlas with one face. No edge transitions. Boundary clamping on all three edges.

---

## 7. Initialization: Deterministic Greedy Placement

### 7.1 Motivation

For small N (palette-sized), random initialization can place most particles on one face, requiring many iterations to redistribute. Deterministic placement gives the optimizer a head start, reducing iteration count and local minimum risk.

### 7.2 Approximate Warped Area via Subdivision

For each non-degenerate face, compute an approximate area in warped coordinates using one level of barycentric subdivision:

1. Compute the 3 edge midpoints of the face in OKLab
2. This produces 4 sub-triangles (3 corner sub-triangles + 1 central sub-triangle)
3. Transform all 6 points (3 original vertices + 3 midpoints) through T (Section 4.3)
4. Sum the areas of the 4 sub-triangles in warped space

**Why subdivision matters:** T is nonlinear, so the image of a planar face is a curved patch, not a planar triangle. Computing area from only the transformed vertices overestimates the warped area of faces whose interiors pass through gray (the vertices may be at moderate chroma while the interior contracts). These are precisely the faces that initialization should deprioritize. One level of subdivision captures this interior contraction at negligible cost — 6 transform evaluations per face, done once.

A face at high chroma throughout has sub-triangle areas that sum to approximately the vertex-only estimate. A face crossing through gray has a contracted central sub-triangle, reducing the total warped area. The subdivision correctly penalizes gray-crossing faces without explicit detection logic.

### 7.3 Algorithm

**For line segments (1D case):**
Pin endpoint seeds. Place remaining particles at equal parametric intervals along the segment.

**For surfaces (2D and 3D cases):**

1. **Pin seeds.** Classify seeds into hull-vertex, boundary, and interior seeds (Section 3.1.1). Hull-vertex seeds are pinned at their vertex positions. Boundary seeds are pinned at their on-surface positions with fixed barycentric coordinates. Interior seeds are pinned at their fixed OKLab positions off-surface. All pinned seeds exert repulsive force but do not move. This guarantees the user's chosen colors appear in the final palette.

2. **Place remaining N − |seeds| particles one at a time:**
   - For each non-degenerate face, compute score = subdivided_warped_area / (1 + count of particles already on it)
   - Select the face with the highest score
   - Within that face, place the particle at the position maximizing minimum warped distance to all existing particles (pinned seeds + previously placed particles). This is computed by evaluating a grid of candidate barycentric positions within the face (e.g., a 5×5 grid of valid barycentric coordinates) and selecting the one with the best worst-case warped distance. This sampled search is more robust than using the geometric centroid, particularly on faces with strong warping where the centroid maps to a poor location in warped space.

3. **Apply exact-gray jitter.** For any movable particle whose initial position has chroma below a threshold (e.g., r < 1e-6), apply a manifold-respecting perturbation as described in Section 4.8 (1D: perturb segment parameter t; surface: perturb in local face tangent plane). This prevents particles from being trapped at the exact-gray degenerate stationary point.

4. The result is an initial configuration where particles are distributed roughly proportionally to warped surface area, with no particle placed in a trivially low-energy position.

---

## 8. Optimization Loop

### 8.1 Algorithm

```
Input: Hull mesh, pinned seeds, initial particle positions,
       parameters (p_start, p_end, r_s, κ, step schedule)

Precompute:
  - Face atlas (local bases, edge transitions, degenerate face flags)
  - Subdivided warped areas for initialization

Loop until convergence:
  1. Map all particles to 3D OKLab positions (barycentric interpolation)
  2. Transform all positions to warped coordinates via T
  3. Compute pairwise warped distances
  4. Compute repulsion gradient in warped space: ∇_{T(x_i)} E_repulsion
     (using current value of p from continuation schedule)
  5. Pull back repulsion gradient to OKLab via warp Jacobian:
     ∇_{x_i} E_repulsion = J_T(x_i)^⊤ · ∇_{T(x_i)} E_repulsion
     (See Section 8.1.1 for J_T)
  6. Convert particle positions to linear RGB
  7. Compute gamut penalty gradient: ∇E_gamut in linear RGB,
     chain-rule through OKLab → linear RGB Jacobian (Section 5.2)
  8. Compute force as negative gradient: F = −(∇_{x_i} E_repulsion + ∇_{x_i} E_gamut)
     (Energy is minimized, so particles move against the gradient.)
  9. Project force onto local face tangent plane → 2D displacement
  10. Scale by current step size (annealed)
  11. Apply displacement with edge-crossing logic (Section 6.4)
  12. Update p according to continuation schedule (ramp from p_start to p_end)
  13. Check convergence (see Section 8.3)

Output: Final OKLab positions for all particles
```

### 8.1.1 Warp Jacobian for Repulsion Gradient Pullback

The repulsion energy is computed in warped space, but particles move in OKLab. The gradient must be pulled back through the warp Jacobian:

$$\nabla_{x_i} E_{\text{repulsion}} = J_T(x_i)^{\top} \cdot \nabla_{T(x_i)} E_{\text{repulsion}}$$

The Jacobian $J_T$ of the warp transform $T(L, a, b) = (L, a', b')$ is a 3×3 matrix. The L row is trivial (∂L'/∂L = 1, ∂L'/∂a = 0, ∂L'/∂b = 0). The chromatic block is a 2×2 matrix in (a, b):

$$\frac{\partial a'}{\partial a} = \frac{r}{r + r_s} + a^2 \cdot \frac{r_s}{r(r + r_s)^2}$$

$$\frac{\partial a'}{\partial b} = a \cdot b \cdot \frac{r_s}{r(r + r_s)^2}$$

and symmetrically for the b' partials, where r = √(a² + b²).

At r = 0, $J_T$ is the zero matrix in the chromatic block (consistent with the contraction). In practice, special-case only exact r = 0 (or r below machine epsilon, e.g., r < 1e-15) by setting the chromatic block to zero. Do **not** use a larger threshold: the initialization jitter (Section 4.8) nudges near-gray particles to chroma ~1e-5, and a Jacobian cutoff at any ε larger than this would silently cancel the jitter's effect by treating the particle as still exactly gray. The analytic Jacobian is well-behaved for all r > 0 and should be computed normally.

**This pullback is critical.** If an implementation computes forces in warped coordinates and applies them directly as OKLab displacements, the directions are wrong wherever T is significantly nonlinear — exactly in the low-chroma region where the algorithm's behavior matters most. The gamut penalty already has an analogous chain rule (Section 5.2); the repulsion term requires the same treatment.

### 8.2 Annealing Schedules

**Step size:** geometric decay, step_k = step_0 · γ^k, with γ ∈ (0.98, 0.999). Start with step_0 large enough for particles to cross a face in a few steps. End when step size is below a perceptual threshold (e.g., ΔE < 0.001).

**Riesz exponent:** linear or geometric ramp from p_start = 2 to p_end = 6 over the first ~50% of iterations, then held constant for refinement. Early low-p phase provides a smooth energy landscape for global exploration. Late high-p phase sharpens focus on worst-case pair separation.

### 8.3 Convergence

**During p continuation (p < p_end):** the energy function itself is changing, so relative energy change |ΔE/E| is not a meaningful convergence test. During this phase, use **maximum particle displacement** as the progress indicator. If the largest displacement in an iteration falls below a threshold while p is still ramping, the step size schedule is driving the dynamics, not convergence — continue ramping p.

**After p reaches p_end:** the energy function is fixed. Convergence is tested by relative energy change: |ΔE/E| < threshold (e.g., 1e-6). Alternatively, stop when the maximum particle displacement per iteration falls below a perceptual threshold (e.g., ΔE < 0.001 in OKLab).

**Fallback:** a hard iteration cap (e.g., 2000 iterations) prevents runaway computation on pathological configurations.

For palette-sized problems (N < 20, faces < 15), convergence typically requires 200–1000 iterations. The total computation is dominated by pairwise force calculation: O(N²) per iteration, negligible for small N.

---

## 9. Output

### 9.1 Final Gamut Check

Despite the gamut-aware energy penalty during optimization, final positions may be marginally out of gamut due to optimization tolerances. Apply Bottosson's gamut_clip_preserve_chroma: preserve hue (h) and lightness (L), reduce chroma until the color is displayable. This is a minimal perturbation because the energy penalty has already pushed particles inside the gamut boundary during optimization.

The fraction of output colors requiring this final clipping depends on the seed configuration — seed sets with deeply saturated blues or cyans may produce more boundary cases. The algorithm does not guarantee that all optimized positions are exactly in gamut; it guarantees that the penalty strongly discourages out-of-gamut positions during optimization and that the final clipping step produces valid sRGB output.

### 9.2 What the Output Represents

The output is a set of N sRGB colors. The relationship between these colors and the optimization domain is:

- **Optimization domain:** the hull surface (or line segment for 2 seeds)
- **Delivered output:** in-gamut sRGB colors, typically very close to the optimized surface positions
- **Family membership:** exact for points that were already in gamut at optimization convergence. For points that required final gamut mapping, family membership is approximate — the gamut clipping moves the point slightly off the hull surface toward lower chroma while preserving hue and lightness.

### 9.3 Conversion

Transform final OKLab positions to linear RGB, then apply sRGB gamma. The output is a set of N sRGB colors.

---

## 10. Complete Parameter Summary

| Parameter | Symbol | Default | Meaning |
|-----------|--------|---------|---------|
| Palette size | N | User-specified | Total colors including seeds |
| Gray avoidance radius | r_s | α · median(seed chromas), clamped | Chroma below which warping is significant |
| Riesz exponent start | p_start | 2 | Initial exponent for smooth exploration |
| Riesz exponent end | p_end | 6 | Final exponent emphasizing worst-case spacing |
| Gamut penalty weight | κ | 0.1 | Strength of gamut boundary avoidance |
| Initial step size | step_0 | 0.01 | Starting displacement magnitude |
| Annealing rate | γ | 0.995 | Step size decay per iteration |
| Convergence threshold | — | 1e-6 | Relative energy change to stop |
| Warping scale | α | 0.4 | Fraction of median chroma for r_s |
| r_s floor | r_{s,min} | 0.005 | Minimum r_s to prevent numerical degeneracy |
| r_s ceiling | r_{s,max} | 0.10 | Maximum r_s to prevent excessive warping |
| Dimensionality threshold | τ_dim | 1e-4 · σ_1 | Relative threshold for collapsing to lower dimension |
| Face area threshold | τ_face | 1e-8 | Minimum face area to be considered non-degenerate |
| Max iterations | — | 2000 | Hard cap to prevent runaway computation |

User-facing parameters are only two: **N** (palette size) and optionally **r_s** (gray avoidance strength, presentable as a "vividness" slider). All other parameters have robust defaults.

---

## 11. Algorithm Properties

### 11.1 What the Algorithm Provides

- Every seed color appears in the output palette (pinned particles — hull-vertex seeds and boundary seeds on-surface, interior seeds off-surface)
- Generated (non-seed) colors are optimized on the convex hull surface (or line segment) of the seeds in OKLab, constraining them to the chromatic family
- Output colors are valid sRGB (gamut penalty during optimization + final clipping)
- The steep Riesz energy with continuation strongly discourages near-duplicate colors, approximating maximin spacing
- Gray avoidance adapts automatically to seed configuration via the warped transform
- Dimensionality and degeneracy are handled explicitly with numerical tolerances

### 11.2 What the Algorithm Does Not Guarantee

- **Global optimality:** particle repulsion on non-smooth manifolds can have local minima, though deterministic initialization and exponent continuation mitigate this
- **Exact maximin spacing:** the steep Riesz potential approximates but does not equal maximin
- **Perfect perceptual uniformity:** OKLab is approximately uniform; large differences exhibit diminishing returns
- **Exact hull surface membership after gamut clipping:** final gamut mapping may move points slightly off-surface (see Section 9.2)
- **All points in gamut before final clipping:** the gamut penalty strongly discourages but does not hard-constrain to gamut
- **Hard gray rejection:** gray avoidance is a soft preference enforced by the warped transform, not a hard constraint. A particle at exact zero chroma is a degenerate stationary point with zero chromatic gradient. Initialization jitter (Section 4.8) mitigates this, but in highly symmetric configurations a near-gray color may persist in the output

### 11.3 Computational Complexity

- Hull construction: O(|seeds| log |seeds|)
- Atlas construction: O(|faces|), done once
- Per iteration: O(N²) for pairwise forces
- Total: O(N² · iterations), negligible for palette-sized problems

---

## 12. Recommended Validation Benchmarks

To validate the algorithm empirically, the following seed configurations should be tested:

| Test Case | Seeds | What It Stresses |
|-----------|-------|-----------------|
| Line segment | 2 vivid complementary colors | 1D repulsion, gray-crossing behavior |
| Gray-crossing triangle | 3 seeds spanning the gray axis | Warped area, face disfavoring, muted avoidance |
| One-sided hue cluster | 4–5 vivid seeds in a narrow hue range | Hull shape vs. palette diversity |
| Full hue wraparound | 4–6 seeds evenly around the hue wheel | Closed hull, no gray issue, pure spacing |
| Muted anchor | 1 warm gray + 4 vivid seeds | r_s robustness, muted seed preservation |
| All muted | 4 low-chroma seeds | Warping gentleness, palette stays muted |
| Gamut stress | Deep blues + saturated cyans | Gamut penalty effectiveness, clipping frequency |
| Near-coplanar | 4 seeds with very small σ_3 | Dimensionality detection, numerical stability |

For each case, measure: minimum pairwise ΔE in OKLab, distribution of pairwise distances, fraction of points requiring final gamut clipping, and subjective family coherence (do generated colors feel like they belong with the seeds).

---

## 13. Responses to Peer Review

### Round 1

#### 13.1 Metric vs. Coordinate Warp Inconsistency (R1 §3.1)

**Status: Fixed in V2.** The original formulation used f(r) = r/(r + r_s), which has f'(0) = 1/r_s, amplifying radial distances near gray. The corrected function f(r) = r²/(r + r_s) has f'(0) = 0, contracting both radial and tangential distances. The approach is now framed consistently as a coordinate transform followed by Euclidean distance.

#### 13.2 Lightness Is Untouched (R1 §3.2)

**Status: Acknowledged, intentionally retained.** Low-chroma positions are strongly disfavored by the chromatic contraction but not absolutely forbidden. Warping L would distort genuine lightness relationships. The hull surface acts as the adaptive chroma constraint. See Section 4.6.

#### 13.3 Objective Function Mismatch (R1 §3.3)

**Status: Addressed in V2, improved in V3.** Replaced Coulomb (p=1) with steep Riesz energy. V3 adds continuation in p (ramp from p=2 to p=6), reducing local-minimum sensitivity. See Section 5.1.

#### 13.4 Gamut Handling (R1 §3.4)

**Status: Addressed in V2, formula corrected in V3, reformulated in V4.** See Section 5.2 and Round 3 §1 below.

#### 13.5 Convex Hull Surface Bias (R1 §3.5)

**Status: Intentionally retained, reframed in V3.** Now described as a deliberate aesthetic prior. See Section 3.4.

### Round 2

#### 13.6 "Gray becomes uninhabitable" is overstated (R2 §1)

**Status: Fixed in V3.** All claims now use "strongly disfavored" rather than "uninhabitable." The document explicitly states that low chroma collapses to the L-axis, not to a point. See Sections 4.3 and 4.6.

#### 13.7 Surface-only is a design prior (R2 §2)

**Status: Fixed in V3.** Section 3.4 frames this as "a deliberate aesthetic prior."

#### 13.8 Gamut penalty formula is wrong (R2 §3)

**Status: Fixed in V3 (quadratic outside penalty), reformulated in V4 (linear RGB channels).** See Round 3 §1.

#### 13.9 Two guarantees conflict (R2 §4)

**Status: Fixed in V3.** Section 9.2 states the relationship between optimization domain, output, and family membership honestly.

#### 13.10 Warped area is approximate (R2 §5)

**Status: Fixed in V3, improved in V4.** Section 7.2 now uses one level of barycentric subdivision as the default, not an optional refinement. See Round 3 §3.

#### 13.11 r_s rule is brittle (R2 §6)

**Status: Fixed in V3.** Uses median with floor/ceiling clamps. See Section 4.7.

#### 13.12 Degenerate hulls need handling (R2 §7)

**Status: Fixed in V3, improved in V4.** Section 3 handles all dimensionality cases. V4 adds explicit numerical tolerances. See Round 3 §2.

#### 13.13 Continuation in p (R2 suggestion)

**Status: Adopted in V3.** See Section 5.1.

### Round 3

#### 13.14 Gamut penalty differentiability (R3 §1)

**Status: Fixed in V4.** The gamut penalty has been reformulated to operate directly in linear RGB space, penalizing out-of-range channels with a smooth quadratic ramp. This is analytically differentiable without requiring differentiation through a gamut mapping routine. The claim that "only a small fraction of outputs need clipping" has been softened — the fraction depends on seed configuration. The Jacobian claim has been corrected in V4.1 (see Round 4 §2). See Section 5.2.

#### 13.15 Near-degenerate slivers need numerical tolerances (R3 §2)

**Status: Fixed in V4.** Explicit numerical tolerances are now specified: a dimensionality threshold τ_dim (relative to the largest singular value) for collapsing near-degenerate seed configurations to lower-dimensional pipelines, and a face area threshold τ_face for flagging individual degenerate faces. Degenerate faces are excluded from initialization and treated as boundaries during edge crossing. See Sections 3.1, 3.2.4, and 6.2.

#### 13.16 Warped area proxy is weakest where it matters most (R3 §3)

**Status: Fixed in V4.** One level of barycentric subdivision is now the default for warped area computation, not an optional refinement. This captures interior contraction on gray-crossing faces where the vertex-only approximation overestimates area. The face centroid as first-particle placement has been replaced with a sampled maximin search within the face, which is more robust on strongly warped faces. See Section 7.2 and 7.3.

#### 13.17 Staged implementation (R3 §4)

**Status: Not adopted.** The reviewer's epistemic argument for staging (separate "is the prior good?" from "is the optimizer correct?") has merit as a general research strategy. However, in this case implementation will be performed in a single pass using LLM-assisted code generation, where the binding constraint is specification clarity rather than developer time or risk management. The specification is now detailed enough to implement directly. We acknowledge that a discrete prototype with greedy farthest-point selection on the same warped metric would provide useful independent validation and may be built in parallel.

### Round 4

#### 13.18 Optimization sign is wrong (R4 §1)

**Status: Fixed in V4.1.** The optimization loop defined "total force = ∇E" which is gradient ascent, not descent. The update rule must use the negative gradient: F = −∇E. Force points away from high energy (away from close neighbors), which is the negative gradient direction of the energy. Section 8.1 now defines force explicitly as F = −(∇E_repulsion + ∇E_gamut) with a comment explaining the sign convention.

#### 13.19 OKLab → linear RGB Jacobian is not constant (R4 §2)

**Status: Fixed in V4.1.** The inverse OKLab transform includes a nonlinear cubic stage (cubing intermediate LMS values), so the Jacobian depends on the current point: J = M_2 · diag(3l̂², 3m̂², 3ŝ²) · M_1, where the intermediate values (l̂, m̂, ŝ) = M_1 · (L, a, b). The two matrices are constant but the diagonal varies per point. Section 5.2 now states this correctly and notes that the Jacobian must be recomputed per particle per iteration, which is cheap.

#### 13.20 Smoothness claim is overstated (R4 §3)

**Status: Fixed in V4.1.** Section 5.3 now describes the constrained optimization as piecewise smooth rather than globally smooth. The ambient energy terms are differentiable, but the polyhedral surface constraint with face transitions and boundary clamping introduces non-smooth boundaries in the parameter space. Gradient-based optimization is still appropriate for piecewise smooth problems, but the document no longer implies global smoothness.

### Round 5

#### 13.21 Interior seeds are not handled (R5 §1)

**Status: Fixed in V4.2.** Added Section 3.1.1 (Seed Classification: Hull Vertices vs. Interior Seeds). Seeds are classified into hull-extreme seeds (vertices of the convex hull, pinned on-surface) and interior seeds (inside the hull, pinned off-surface). Interior seeds remain at their fixed OKLab positions, exert repulsive force on all other particles, but do not move or participate in surface dynamics. This covers the common case of a user providing a "bridge" or "anchor" color that lies inside the hull of the other seeds. The initialization section (7.3) now references this classification.

#### 13.22 Repulsion gradient must be pulled back through warp Jacobian (R5 §2)

**Status: Fixed in V4.2.** Added Section 8.1.1 (Warp Jacobian for Repulsion Gradient Pullback). The optimization loop now explicitly computes the repulsion gradient in warped space, then pulls it back to OKLab via J_T^⊤. The Jacobian of the warp transform is derived analytically, with a note that at r = 0 the chromatic block is zero (correct behavior: particles at gray receive no chromatic force). The document warns that applying warped-space forces directly as OKLab displacements is a subtle but serious implementation error.

#### 13.23 Convergence criterion is underspecified during p continuation (R5 §3)

**Status: Fixed in V4.2.** Section 8.3 now specifies two convergence regimes. During p continuation (p < p_end), the energy function is changing, so |ΔE/E| is not meaningful; maximum particle displacement is used instead. After p reaches p_end, the standard relative energy change test applies. A hard iteration cap provides a fallback.

#### 13.24 N ≥ number of seeds precondition (R5 §4)

**Status: Fixed in V4.2.** Section 1.1 now explicitly requires N ≥ number of distinct seeds, with the reasoning that every seed is pinned in the output.

### Round 6

#### 13.25 Boundary seeds missing from taxonomy (R6 §1)

**Status: Fixed in V4.3.** Section 3.1.1 now classifies seeds into three categories: hull-vertex seeds (pinned at vertices), boundary seeds (on a face interior or edge, pinned on-surface with fixed barycentric coordinates), and interior seeds (pinned off-surface). Detection procedure for boundary seeds is specified: test non-vertex seeds against each hull face via barycentric coordinates and plane distance. This closes the geometric hole where a seed on the hull surface but not at a vertex would be misclassified.

#### 13.26 Exact-gray degenerate critical point (R6 §2)

**Status: Acknowledged and mitigated in V4.3.** New Section 4.8 documents the exact-gray limitation: because f'(0) = 0 and the chromatic block of J_T is zero at r = 0, a particle at exact zero chroma is a degenerate critical point that gradient descent cannot escape. This is mitigated by initialization jitter — a tiny perturbation (~1e-5) applied to any particle initialized below a chroma threshold. This breaks symmetry and allows the gradient to push the particle away from gray. The limitation is also recorded in Section 11.2 (What the Algorithm Does Not Guarantee). Gray avoidance is explicitly characterized as a soft preference, not a hard rejection.

### Round 7

#### 13.27 Jitter violates constraint manifold (R7 §1)

**Status: Fixed in V4.4.** The previous jitter was a fixed +a displacement in ambient OKLab, which moves the particle off the line segment (1D) or off the hull face (2D/3D). Section 4.8 now specifies manifold-respecting jitter: in 1D, perturb the scalar parameter t; in 2D/3D, project the +a direction into the local face tangent plane (falling back to the e_1 basis vector if the projection is negligible). The sign alternates by particle index to avoid systematic hue bias. Section 7.3 references the updated procedure.

#### 13.28 J_T ε threshold can cancel jitter (R7 §2)

**Status: Fixed in V4.4.** Section 8.1.1 previously suggested setting the chromatic Jacobian block to zero for r < ε with an unspecified ε. If ε ≥ 1e-5 (the jitter magnitude), the Jacobian cutoff silently cancels the jitter's effect. The section now specifies: special-case only exact r = 0 (or r < machine epsilon, ~1e-15). The analytic Jacobian is well-behaved for all r > 0 and must be computed normally.

#### 13.29 "No local minima" in 1D is overstated (R7 §3)

**Status: Fixed in V4.4.** Softened to "the 1D case is much better behaved and typically converges reliably."

#### 13.30 "Technically a saddle" is unjustified (R7 §4)

**Status: Fixed in V4.4.** Changed to "degenerate stationary point," which is accurate without requiring a proof of saddle-point structure.

---

## 14. Implementation Components

### Component Dependency Order

```
[1] Color Conversion (sRGB ↔ linear RGB ↔ OKLab)
         ↓
[2] Dimensionality Detection (SVD of mean-centered seeds)
         ↓
    ┌───────────────────────────────────────┐
    │ 1D: Line segment                      │
    │ 2D: Flat polygon + atlas              │
    │ 3D: Full hull + atlas + degeneracy    │
    └───────────────────────────────────────┘
         ↓
[2b] Seed Classification (hull-vertex / boundary / interior)
         ↓
[3] Warped Transform (f(r) = r²/(r + r_s), transform T, Jacobian J_T, distance function)
         ↓
[4] Energy Function (Riesz repulsion with continuation + linear RGB gamut penalty)
         ↓
[5] Initialization (pin seeds, subdivided warped area, sampled greedy placement, gray jitter)
         ↓
[6] Optimization Loop (forces in warped space → J_T pullback → tangent projection → displacement → edge crossing → anneal p and step size)
         ↓
[7] Output (final gamut clip → OKLab → sRGB)
```

### Estimated Implementation Complexity

| Component | Lines of Code (approx.) | Notes |
|-----------|------------------------|-------|
| Color conversion | 30 | Ottosson's reference, including linear RGB ↔ OKLab Jacobian |
| Dimensionality detection | 25 | SVD + threshold logic |
| Convex hull | Library call | QHull / SciPy / CGAL |
| Seed classification | 30 | Barycentric tests for boundary seeds |
| Face atlas + degeneracy | 100 | Basis computation, transitions, area thresholds, boundary flags |
| Warped transform + Jacobian | 35 | Transform, distance function, J_T for pullback |
| Energy function | 50 | Riesz energy with continuation + linear RGB gamut penalty |
| Initialization | 85 | Subdivided warped area, sampled greedy placement, gray jitter |
| Optimization loop | 130 | Warped gradient, J_T pullback, edge crossing, dual annealing |
| 1D specialization | 40 | Line segment repulsion |
| Output | 20 | Gamut mapping + conversion |
| **Total** | **~565** | Excluding library dependencies |

---

## 15. Summary

The algorithm generates perceptually distinct color palettes by treating the problem as particle repulsion on the convex hull surface of user-defined seed colors in OKLab space. A coordinate transform contracts the low-chroma region of the color space, causing particles to strongly disfavor muddy grays without explicit topology manipulation. The hull geometry adapts the palette's character automatically: vivid seeds produce vivid palettes, muted seeds produce muted palettes, and the single parameter r_s controls the strength of gray avoidance. A steep Riesz energy with continuation from p=2 to p=6 ensures worst-case pair distinguishability, and a smooth gamut penalty in linear RGB keeps colors displayable throughout optimization.

**The hull defines the family. The warping defines the taste. The physics distributes the colors.**
