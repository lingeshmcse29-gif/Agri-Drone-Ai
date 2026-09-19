# AgriDrone AI — Phase 4 Verification Report

**Phase:** Phase 4 — Deterministic Computer Vision & Real Vegetation Indices  
**Status:** COMPLETED  
**Verification Date:** September 7, 2026  
**Environment:** Node.js v24.18.0, MongoDB v7.0.14, Sharp v0.33.5, Express 4.x, React 18.3, Vite 6.4  

---

## 1. Executive Summary

Phase 4 establishes a deterministic, pixel-level computer vision engine for drone RGB imagery in **AgriDrone AI**. 

All prototype placeholders, arbitrary grid hardcodings, and `Math.random()` calls in the agronomic and image-processing services have been completely eradicated. In their place, a dedicated mathematical engine (`backend/services/vegetationIndexService.js`) analyzes uncompressed raw RGB pixel buffers, standardizes normalized chromatic channels ($r, g, b \in [0, 1]$), computes real vegetation indices (**ExG**, **VARI**, and **GLI**), explicitly distinguishes bare ground and shadow from stressed foliage, calculates canopy coverage and vegetation stress percentages, and persists real metrics into `Scan.indexMetrics`.

Additionally, the scan status polling endpoint (`GET /api/scans/:id/status`) has been hardened with mandatory JWT authentication (`protect` middleware), verifying both user identity and field ownership.

---

## 2. RGB Physical Limitation & Scientific Transparency

Standard commercial UAV cameras capture visual spectrum RGB light (Red ~660 nm, Green ~560 nm, Blue ~480 nm). They lack Near-Infrared (NIR, 700–900 nm) sensors.

True NDVI strictly requires Near-Infrared data:
$$\text{NDVI} = \frac{\text{NIR} - \text{Red}}{\text{NIR} + \text{Red}}$$

Claiming true NDVI from RGB sensors is scientifically invalid. Therefore:
1. **No True NDVI Claims**: The system explicitly documents that it operates on high-resolution visible RGB imagery.
2. **Standard Visible Vegetation Indices**: The system implements the established agronomic RGB indices:
   - **ExG (Excess Green Index)**: Quantifies green plant contrast against soil.
   - **VARI (Visual Atmospheric Resistance Index)**: Highly correlated with crop vegetation fraction while resisting atmospheric aerosol effects.
   - **GLI (Green Leaf Index)**: Sensitive to leaf chlorophyll content.
3. **RGB Vegetation Proxy**: The persisted field `Scan.indexMetrics.ndviProxy` is calculated as $\text{clamp}(0.5 + 0.5 \cdot \text{variMean}, 0, 1)$ and strictly labeled across UI and API responses as:
   `RGB Vegetation Proxy (VARI approximation)` — never presented as NIR satellite NDVI.

---

## 3. Mathematical Formulations & Safeguards

### Channel Normalization
Raw RGB bytes ($R, G, B \in [0, 255]$) are normalized:
$$r = \frac{R}{255.0}, \quad g = \frac{G}{255.0}, \quad b = \frac{B}{255.0}$$

### 1. Excess Green Index (ExG)
$$\text{ExG} = 2g - r - b$$
- **Theoretical Range**: $[-2.0, 2.0]$
- **Interpretation**: Pure green ($0, 1, 0$) yields $+2.0$. Pure red or blue yields $-1.0$. Neutral gray yields $0.0$.
- Scale is consistent across the entire application.

### 2. Visual Atmospheric Resistance Index (VARI)
$$\text{VARI} = \frac{g - r}{g + r - b}$$
- **Singularity Protection**: If $|g + r - b| < 10^{-5}$, the pixel is recorded as an invalid denominator singularity (`invalidVariPixels`) and excluded from the distribution average.
- **Scientific Preservation of Raw VARI**: The mathematically calculated VARI is preserved without silent clamping to $[-1, 1]$.
- **Derived Bounded Representation**: For downstream UI gauge display and proxy mapping, a derived clamped representation (`variClamped` / `variClampedMean`) bounded to $[-1.0, 1.0]$ is explicitly exposed alongside the raw value.
- **Protection**: Zero risk of `NaN`, `Infinity`, or division-by-zero distortion.

### 3. Green Leaf Index (GLI)
$$\text{GLI} = \frac{2g - r - b}{2g + r + b}$$
- **Singularity Protection**: Evaluated only when $2g + r + b \ge 10^{-5}$.
- **Clamping**: Bounded strictly to $[-1.0, 1.0]$.

### 4. Pixel Classification & Brown/Senescent Vegetation Limitation
Bare soil and shadows are not stressed crops. The classification distinguishes:
- **Shadow**: $r + g + b < 0.12$ (low total luminance; excluded from vegetation calculations).
- **Bare Soil / Non-Vegetation**: $\text{ExG} \le 0.04$ or $r \ge g$ (dry soil, gravel, mulch, structures).
- **Vegetation**: $\text{ExG} > 0.04$ and $g > r$ and $g > b$ and not shadow.
- **Stressed Vegetation**: Plant foliage pixels exhibiting chlorosis, yellowing, or browning:
  $$\text{Stressed} \iff \text{Vegetation is TRUE and } (\text{VARI} < 0.05 \text{ or } \text{GLI} < 0.05 \text{ or } (g - r) < 0.03)$$

> [!NOTE]
> **Scientific Limitation Notice (Brown / Senescent Crop Residues)**:
> In visible spectrum RGB imagery (lacking NIR or Red-Edge bands), strongly brown, necrotic, or senescent crop residue exhibits $r \ge g$ and $\text{ExG} \le 0.04$, which is spectrally indistinguishable from bare brown soil. The deterministic classifier intentionally treats $r \ge g$ as bare ground / non-vegetation to avoid false positive canopy cover inflation over bare earth. The RGB stress classifier primarily detects visible green-to-yellow chlorosis, foliar lesions, and early stage leaf degradation where $g > r$ and $g > b$ still hold. Comprehensive botanical diagnosis cannot be made from visible RGB color alone.

### 5. Derived Agronomic Metrics
- **Canopy Cover Percentage**:
  $$\text{canopyCoverPct} = \text{clamp}\left(\frac{N_{\text{veg}}}{N_{\text{valid}}} \times 100, 0, 100\right)$$
  where $N_{\text{valid}}$ represents all valid, readable source pixels in the spatial analysis frame ($N_{\text{valid}} = N_{\text{shadow}} + N_{\text{bare\_soil}} + N_{\text{veg}}$).
- **Vegetation Stress Percentage**:
  $$\text{vegetationStressPct} = \begin{cases} \text{clamp}\left(\frac{N_{\text{stressed\_veg}}}{N_{\text{veg}}} \times 100, 0, 100\right) & \text{if } N_{\text{veg}} > 0 \\ 0.0 & \text{if } N_{\text{veg}} = 0 \end{cases}$$
- **Visual Health Score**:
  $$\text{visualHealthScore} = \text{clamp}(100 - \text{vegetationStressPct}, 0, 100)$$
  Documented as a visual crop health estimate, not a biological laboratory assay.

---

## 4. Benchmarking & Real UAV Image Measurements

Measurements performed on the bundled drone survey orthomosaic (`backend/uploads/drone/sample_orthomosaic.jpg`):

| Metric / Property | Measured Output | Finiteness & Determinism Check |
| :--- | :--- | :--- |
| **Image Dimensions (Source)** | $1200 \times 896$ px | Confirmed finite, exact integer pair |
| **Analysis Dimensions** | $1200 \times 896$ px | Confirmed finite, exact integer pair |
| **Total Pixels** | $1,075,200$ px | Confirmed finite, exact integer |
| **validPixels** | $1,075,200$ px | Confirmed finite, exact integer |
| **shadowPixels** | $6,834$ px | Confirmed finite, exact integer |
| **bareSoilPixels** | $138,023$ px | Confirmed finite, exact integer |
| **vegetationPixels** | $930,343$ px | Confirmed finite, exact integer |
| **stressedVegetationPixels** | $58,859$ px | Confirmed finite, exact integer |
| **invalidVariPixelCount** | $10$ px | Confirmed finite, exact integer |
| **invalidGliPixelCount** | $0$ px | Confirmed finite, exact integer |
| **exgMean** | **+0.3602** | Confirmed finite, non-NaN |
| **variMean (Raw Mathematical Mean)** | **+0.1682** | Confirmed finite, non-NaN, un-clamped |
| **variClampedMean (Derived Bounded Mean)** | **+0.1664** | Confirmed finite, bounded to $[-1, 1]$ |
| **gliMean** | **+0.2620** | Confirmed finite, non-NaN |
| **canopyCoverPct** | **86.5%** | Confirmed finite, non-NaN |
| **vegetationStressPct** | **6.3%** | Confirmed finite, non-NaN |
| **stressPct** | **6.3%** | Confirmed finite, non-NaN |
| **visualHealthScore** | **94 / 100** | Confirmed finite, non-NaN |
| **ndviProxy / RGB Vegetation Proxy** | **0.5832** | Confirmed finite, non-NaN |
| **exgRange** | $[-0.0784, +0.6471]$ | Confirmed finite, non-NaN |
| **variRange (Raw Mathematical Range)** | $[-25.0000, +26.0000]$ | Confirmed finite, un-clamped raw bounds |
| **variClampedRange (Derived Bounded Range)** | $[-1.0000, +1.0000]$ | Confirmed finite, bounded range |
| **gliRange** | $[-0.2281, +1.0000]$ | Confirmed finite, non-NaN |
| **Original File Preservation** | $1,398,747$ bytes before and after ($0$ byte change, mtime untouched) | Confirmed preserved |
| **Determinism Across 3 Consecutive Runs** | Run 1 $\equiv$ Run 2 $\equiv$ Run 3 (100% identical bit-for-bit across all properties) | Confirmed strictly deterministic |

---

## 5. Mathematical Synthetic Image Verification

Small synthetic pixel matrices tested in `backend/tests/phase4_vision.test.js`:

| Test Image Fixture | Expected ExG | Expected Canopy % | Expected Stress % | Result |
| :--- | :--- | :--- | :--- | :--- |
| **Pure Green** ($0, 255, 0$) | $+2.0000$ | $100.0\%$ | $0.0\%$ | **PASS** |
| **Pure Red** ($255, 0, 0$) | $-1.0000$ | $0.0\%$ | $0.0\%$ | **PASS** |
| **Pure Blue** ($0, 0, 255$) | $-1.0000$ | $0.0\%$ | $0.0\%$ | **PASS** |
| **50% Green / 50% Soil** | Positive mean | Exactly $50.0\%$ | $0.0\%$ | **PASS** |
| **Chlorotic Yellow Foliage** | Positive ExG | $100.0\%$ | $100.0\%$ | **PASS** |
| **Pure Bare Sand / Gravel** | Negative ExG | $0.0\%$ | $0.0\%$ | **PASS** |
| **Singularity** ($g+r-b = 0$) | Safeguarded | $0.0\%$ | Finite (No `NaN`/`Infinity`) | **PASS** |

---

## 6. Audit for Randomness Elimination

A complete automated scan of all `.js` files across `backend/` (excluding `node_modules` and tests) confirmed:
```text
Zero Math.random() calls exist in backend services/controllers.
```
- Tile health scores: derived from pixel buffers.
- Anomaly detection: determined by real tile `visualHealthScore < 65`.
- Anomaly patch cropping: extracted from real pixel coordinates via Sharp.
- Ollama fallback: deterministic mapping based on `cropType` and severity.

---

## 7. Security Hardening: Status Polling Endpoint

`GET /api/scans/:id/status` has been upgraded in `backend/routes/scanRoutes.js` and `backend/controllers/scanController.js`:
- Middleware changed from `optionalAuth` to strict `protect`.
- Missing or invalid Bearer token: returns HTTP `401 Unauthorized` (`UNAUTHORIZED`).
- User requesting a scan belonging to a field owned by another user: returns HTTP `403 Forbidden` (`FORBIDDEN`).
- Valid request: returns real persisted status, timestamps, progress, and `indexMetrics`.

---

## 8. Automated Test Suite Results

Execution command:
```bash
npm test
```

### Breakdown by Test Suite
1. **Phase 1: Environment, Configuration & Security Suite** (`phase1_server.test.js`):
   - 16 Environment Validation Tests: `16 PASS, 0 FAIL`
   - 2 Database Resilience Tests: `2 PASS, 0 FAIL`
   - 11 Security, CORS & Error Envelope Tests: `11 PASS, 0 FAIL`
   - Subtotal: **29 tests passing**

2. **Phase 2: Database Layer & Persistence Integrity Suite** (`phase2_database.test.js`):
   - 6 Schema and Index Audits: `6 PASS, 0 FAIL`
   - 2 LIVE Isolation & Auto-seeding Guard Tests: `2 PASS, 0 FAIL`
   - 2 Demo Seeder & Idempotency Tests: `2 PASS, 0 FAIL`
   - 2 Persistence Cascades & ID Validation Tests: `2 PASS, 0 FAIL`
   - Subtotal: **12 tests passing**

3. **Phase 3: UAV Upload Pipeline & State Machine Suite** (`phase3_pipeline.test.js`):
   - 14 State machine, decoupled upload, unauthenticated 401, invalid token 401, non-owner 403, active lock, recovery tests: `14 PASS, 0 FAIL`
   - Subtotal: **14 tests passing**

4. **Phase 4: Deterministic Computer Vision & Real Vegetation Indices Suite** (`phase4_vision.test.js`):
   - `SAFEGUARD: clamp restricts values strictly within bounds`: PASS
   - `SAFEGUARD: safeDivide returns fallback on zero or sub-epsilon denominator`: PASS
   - `EXG: Pure Green pixel (R=0, G=255, B=0) yields maximum positive ExG (2.0)`: PASS
   - `EXG: Pure Red pixel (R=255, G=0, B=0) yields negative ExG (-1.0) and 0% canopy`: PASS
   - `EXG: Pure Blue pixel (R=0, G=0, B=255) yields negative ExG (-1.0) and 0% canopy`: PASS
   - `VARI: Handles singularity (G + R - B = 0) without NaN or Infinity`: PASS
   - `VARI RAW ACCURACY: Mathematical VARI exceeding [-1, 1] is preserved as finite raw value without silent clamping`: PASS
   - `GLI: Evaluates (2g - r - b) / (2g + r + b) safely without division by zero`: PASS
   - `CANOPY SCENARIO 1: 100% Green foliage yields exactly 100.0% canopyCoverPct`: PASS
   - `CANOPY SCENARIO 2: 50% Green foliage / 50% Bare soil image produces exactly 50.0% canopyCoverPct`: PASS
   - `CANOPY SCENARIO 3: 50% Green foliage / 50% Shadow produces exactly 50.0% canopyCoverPct with validPixels denominator`: PASS
   - `CANOPY SCENARIO 4: Vegetation + invalid-index pixel preserves unambiguous validPixels denominator`: PASS
   - `CANOPY SCENARIO 5 (ZERO VEGETATION): Bare soil field yields 0.0% canopy, 0.0% vegetationStressPct and finite metrics`: PASS
   - `STRESS: Chlorotic yellow vegetation correctly classified as stressed without misclassifying soil`: PASS
   - `DETERMINISM: 5 consecutive executions on synthetic image produce strictly identical (===) outputs`: PASS
   - `ROBUSTNESS: Rejects unreadable or corrupted image files cleanly`: PASS
   - `PRESERVATION: Original sample UAV image remains untouched after analysis`: PASS
   - `REAL UAV IMAGE: Processes sample_orthomosaic.jpg with genuine pixel metrics`: PASS
   - `DETERMINISM: Three full runs on sample_orthomosaic.jpg yield identical results`: PASS
   - `AUDIT: Zero Math.random() calls exist in backend services/controllers`: PASS
   - Subtotal: **20 tests passing**

### Overall Result
```text
Total Tests Executed: 75
Total Tests Passed:   75
Total Tests Failed:   0
Execution Duration:   14.03 seconds
```

---

## 9. Frontend Production Build Verification

Execution command:
```bash
npm --prefix frontend run build
```
Result:
```text
vite v6.4.3 building for production...
✓ 2329 modules transformed.
dist/index.html                     1.24 kB │ gzip:   0.65 kB
dist/assets/index-BlvoGnTI.css     38.32 kB │ gzip:   7.26 kB
dist/assets/index-BOCN_QzR.js   1,028.90 kB │ gzip: 287.47 kB
✓ built in 7.81s
Exit code: 0 (Zero errors)
```

---

## 10. Strict Phase 4 Boundary & Phase 5 Hand-Off

### Strict Boundary Enforcement
The following capabilities were intentionally excluded from Phase 4 and reserved for Phase 5:
- No geographic coordinate projection
- No GPS georegistration / affine transformation
- No field boundary polygon intersection
- No Leaflet hotspot placement changes
- No EXIF GPS tag extraction

### Phase 5 Hand-Off
Phase 4 successfully delivers:
1. Deterministic pixel-level vegetation indices (ExG, VARI, GLI).
2. True canopy coverage and vegetation stress percentages.
3. Tile-level vegetation metrics and anomaly extraction from Sharp image buffers.

The repository is now ready for:
> **PHASE 5 — Spatial Geo-Registration & Hotspot Segmentation**
- Implementing affine transformation from image pixel coordinates $(x, y)$ to real-world WGS84 GPS latitude/longitude.
- Projecting hotspots onto geographic field polygons.
- Accurately toggling `isGpsEstimated` based on EXIF GPS metadata.
- Extracting localized anomaly bounding boxes with min $256 \times 256$ resolution into `uploads/hotspots/`.
