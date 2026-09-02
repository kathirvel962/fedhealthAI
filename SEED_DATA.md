# Fedhealth AI - Demonstration Dataset Specification

> [!WARNING]
> **DEMONSTRATION / SYNTHETIC DATA ONLY**  
> All patient records, clinical symptoms, laboratory vitals, and diagnostic histories generated in this database are **synthetic / simulated**. They are created deterministically for clinical visualization, federated learning orchestration, and system demonstrations, and **do not** represent real patients or actual clinical events.

---

## 1. Master Primary Health Centers (PHCs)

The database seeds exactly five Master PHCs located in the Coimbatore district:

| PHC ID | Official Name | Area / City | Latitude | Longitude | Official Contact Email |
|--------|---------------|-------------|----------|-----------|------------------------|
| **PHC_1** | Narasipuram Primary Health Center | Thondamuthur | `10.9915` | `76.7712` | `phc.1fed@gmail.com` |
| **PHC_2** | S.M.C. Palayam Primary Health Center | Annur | `11.1769` | `77.0703` | `phc.2fed@gmail.com` |
| **PHC_3** | Z. Puravipalayam Primary Health Center | Pollachi North | `10.7360` | `76.9629` | `phc.3fed@gmail.com` |
| **PHC_4** | Vellalore Primary Health Center | Madukkarai | `10.9778` | `77.0277` | `phc.4fed@gmail.com` |
| **PHC_5** | Kuniamuthur Primary Health Center | Madukkarai / Coimbatore South | `10.9627` | `76.9550` | `phc.5fed@gmail.com` |

---

## 2. Demonstration User Accounts

All accounts use the password **`password123`** (hashed using Django's standard bcrypt implementation):

| Username | Role | Associated Node | Dashboard Access |
|----------|------|-----------------|------------------|
| **`district_admin`** | `DISTRICT_ADMIN` | District-wide | Full District & Configuration |
| **`phc1_user`** | `PHC_USER` | `PHC_1` | Local Narasipuram PHC |
| **`phc2_user`** | `PHC_USER` | `PHC_2` | Local S.M.C. Palayam PHC |
| **`phc3_user`** | `PHC_USER` | `PHC_3` | Local Z. Puravipalayam PHC |
| **`phc4_user`** | `PHC_USER` | `PHC_4` | Local Vellalore PHC |
| **`phc5_user`** | `PHC_USER` | `PHC_5` | Local Kuniamuthur PHC |
| **`surveillance_user`** | `SURVEILLANCE_OFFICER` | District-wide | Surveillance Map & Alerts |

---

## 3. Patient Dataset and Distributions

Exactly **10,000 patient records** are seeded (2,000 per PHC) using a fixed random seed `20260829` to enforce deterministic, repeatable calculations.

### Demographic Profiles
- **`PHC_1`**: Younger population skew (triangularly centered around 24 years old). Gender: 49% Male / 51% Female.
- **`PHC_2`**: Balanced adult population. Gender: 51% Male / 49% Female.
- **`PHC_3`**: Older population skew (triangularly centered around 62 years old). Gender: 52% Male / 48% Female.
- **`PHC_4`**: Balanced adult population. Gender: 50% Male / 50% Female.
- **`PHC_5`**: Mixed adult population. Gender: 51% Male / 49% Female.

### Target Disease Distributions
The baseline diagnostic distributions showcase statistical heterogeneity across sites, which computes non-zero pairwise Jensen-Shannon Divergences:

| Disease | PHC_1 | PHC_2 | PHC_3 | PHC_4 | PHC_5 |
|---------|-------|-------|-------|-------|-------|
| **Dengue** | ~30% (Dominant) | ~10% | ~10% | ~12% | ~16% |
| **Malaria** | ~12% | ~30% (Dominant) | ~10% | ~10% | ~16% |
| **Viral Fever** | ~16% | ~18% | ~40% (Dominant) | ~15% | ~18% |
| **Pneumonia** | ~12% | ~12% | ~12% | ~25% (Dominant) | ~14% |
| **Typhoid** | ~10% | ~10% | ~13% | ~18% | ~14% |
| **Healthy** | ~20% | ~20% | ~15% | ~20% | ~22% |

---

## 4. Surveillance and Temporal Outbreak Scenario

To demonstrate real-time disease outbreaks, the last 14 days of patient admissions contain an elevated concentration of select diseases:
- **`PHC_2`**: Malaria incidence increases significantly (up to ~55%).
- **`PHC_3`**: Viral Fever incidence increases significantly (up to ~70%).
- **`PHC_4`**: Pneumonia incidence increases moderately (up to ~50%).
- **`PHC_1` & `PHC_5`**: Remain stable, serving as control nodes.

This disease activity automatically triggers:
1. **Elevated PHC Risk Scores**: Computed dynamically by `city_risk_calculator.py` using severity, outbreak flag, and disease prevalence.
2. **Surveillance Alerts**: Generated automatically by the surveillance engine for neighboring target PHCs with a mixture of `NEW`, `ACKNOWLEDGED`, and `RESOLVED` statuses.

---

## 5. Machine Learning & Federated Learning Round

The seed script orchestrates:
- **Local XGBoost Models**: Version 1 models are trained on baseline patient data. Version 2 models are trained after the outbreak patients are added, which naturally calculates and logs model drift.
- **Global Neural Network Model**: Federated Round 1 is executed using `perform_federated_round`, creating a global model and version (`global_v1`) along with client updates.

---

## 6. How to Rebuild & Reseed

Ensure your virtual environment is active in the `backend/` directory, then execute:

```bash
# Set environment encoding for Windows terminals to display logs correctly
$env:PYTHONIOENCODING="utf-8"

# Reset the database and run the seed script
python manage.py seed_demo_data

# Run validation checks on the seeded database
python manage.py validate_demo_data
```
