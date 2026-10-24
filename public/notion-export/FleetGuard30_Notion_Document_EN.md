# 🚘 FleetGuard 30 — 30-Vehicle No-Dashcam Fleet Monitoring & Dispatch Wiki (Notion Export · English Edition)

> 💡 **Executive Summary**
> - **Site:** `4400 Northpark Dr, Opelika, AL 36801` (Lee County, Alabama, USA · `32.6912° N, -85.3298° W`)
> - **Managed fleet:** 30 company vehicles (`AL 41A-2237` – `AL 41F-6210`, Lee County prefix `41`)
> - **Core architecture:** 0 in-vehicle dashcams · 0 commercial OBD devices · `$0` monthly subscription · **100% employee smartphone (BYOD) 6-axis IMU sensors + factory Bluetooth / QR**
> - **GitHub repository:** [https://github.com/vincenti85/vehicle_monitor](https://github.com/vincenti85/vehicle_monitor)

---

## 1. Zero-Config 1-Click Initial Setup Guide

| Step | Setup Item | Where | Time | Key Points |
| :--- | :--- | :--- | :--- | :--- |
| **STEP 1** | **Pick a one-click operating preset** | Admin Console → `⚙️ Geofence · Sensor · Approval Policy` | **5 sec** | No need to adjust 9 individual sliders: click just one card — **🟢 Mode A (Autonomous)** / **🔵 Mode B (Standard Approval)** / **🔴 Mode C (High-Security Audit)** — and it applies to all 30 vehicles instantly |
| **STEP 2** | **Simple vehicle & user CSV import** | Admin Console → `🚗 30 Vehicles` / `👥 Employee Governance` | **1 min** | No Bluetooth MAC addresses required: upload a **3-column CSV (`Vehicle #, Plate, Model`)** and IDs are generated and mapped automatically |
| **STEP 3** | **Print 30 zero-config QR key tags** | Admin Console → `🖨️ Print 30 Zero-Config QR Key-Tag Sheet` | **1 min** | Attach the printed QR tags to the key rings, and drivers can **scan and depart in 1 second** without any Bluetooth pairing |

---

## 2. Daily Operations Manual for Employees (Drivers) & Admins

### 📱 Driver (Employee) 4-Step Routine
1. **Install the mobile web app (one time only):** Open the deployed URL on your smartphone (Safari / Chrome) → **[Add to Home Screen]** → tap **`[Connect Phone Sensors]`** (GPS · 6-axis IMU) at the top and allow the permissions
2. **Depart (choose one):**
   - **1-second express start:** Tap the key QR scan button (**`⚡ 1-Sec Key QR Start`**) and drive off immediately
   - **Standard 4-stage dispatch:** `Stage 1 Request (REQUESTED)` → `Stage 2 Admin Approval (APPROVED)` → `Stage 3 Key Pickup & In Use (IN_USE)`
3. **If you get an unauthorized-departure warning:** If you forgot to file a request and your phone alerts you once you reach `15 km/h`, tap **`[Submit Reason]`** to switch the trip to "Depart-first, report-later"
4. **Return the vehicle:** Drive back into the `4400 Northpark Dr` garage geofence (`150 m`) and turn off the engine (Bluetooth disconnects). The vehicle is **auto-returned (`RETURNED`)** with no app interaction, and the tax mileage log is generated automatically

### 🔐 Fleet Admin Security Console Routine
- **Secure sign-in:** Click **`[3. Admin Console (PIN)]`** in the top navigation and enter the admin-only 4-digit security PIN (`••••`)
- **No-Dashcam crash reconstruction review:** Review the smartphone 6-axis IMU report (acceleration `G-Force` + gyro rotation `°/s` + 30-second speed change `Δv`), record the actions taken, and suspend dispatch rights for at-fault drivers
- **Ghost Trip odometer audit:** Once a week, enter the actual dashboard odometer reading (`km`). If it differs from the app's cumulative GPS mileage by `+5 km` or more, the system back-calculates who entered the garage and which employees had permissions turned OFF during that window, and identifies the suspect automatically

---

## 3. 7 Hands-On Test Scenarios & QA Verification Checklists

> ✅ You can tick the checklists below directly on the Notion page to track which tests are complete.

### 🧪 SCENARIO 01. Zero-Config 1-Second Boarding (Key QR Scan Start) & Garage Auto-Return
- **Difficulty:** Easy | **Estimated time:** 30 sec
- **Steps:**
  1. In the **[Employee Mobile App]** panel on Tab **`1. Request & Return`**, select a driver (`Jihoon Kang, Staff`) and an idle vehicle (`Vehicle #02 AL 41B-5104 [IDLE]`).
  2. Click the **`[⚡ 1-Sec Key QR Start (Unit #02)]`** button at the top of the panel.
  3. On the radar map in Tab **`2. 30-Fleet Telemetry`**, confirm that `Vehicle #02` is moving in blue (`AUTHORIZED`).
  4. Go to the mobile app's **`[Request · Return]`** tab and click the green **`[Auto-Return to HQ Garage (Unit #02)]`** button at the bottom.
- **Verification checklist:**
  - [ ] Does `Vehicle #02` switch to normal operation (`AUTHORIZED`) within 1 second, with no manual Bluetooth pairing or approval wait?
  - [ ] When you click garage auto-return, does the vehicle go back to `IDLE` and is a trip record (`+16.4 km`) added to the **[IRS Mileage Log]** tab?

---

### 🧪 SCENARIO 02. Standard 4-Stage Dispatch Lifecycle (`Request → Approve → In Use → Return`) & Persistent DB Check
- **Difficulty:** Medium | **Estimated time:** 1 min
- **Steps:**
  1. In the mobile app's **[Request · Return]** tab, select an idle vehicle (`Vehicle #05 AL 41E-7731`), enter the destination (`HMMA Montgomery Plant`) under **1. Request Vehicle**, and click **`[Request]`** (`REQUESTED`).
  2. On the request card that appears in the **[Dispatch Request · Approval · Active · Return Board]**, click **`[Approve]`**. (Or click **`[Approve Now]`** inside the mobile app for a quick demo.)
  3. On the approved (`APPROVED`) card, click **`[Start Trip]`** (key pickup & start of use).
  4. On the in-use (`IN_USE`) card, confirm the parking lot (`Northpark Lot A`) and click **`[Return]`** (vehicle & key returned).
- **Verification checklist:**
  - [ ] Do the 4 status badges (`REQUESTED` → `APPROVED` → `IN_USE` → `RETURNED`) change in order?
  - [ ] Are the request, approval, departure, and return events each logged in the **[Recent Notifications]** push feed?
  - [ ] After a browser **refresh (`F5`)**, are the return history and tax mileage log still preserved in the backend DB?

---

### 🧪 SCENARIO 03. Unauthorized Removal While the Key Manager Is Away (`Red Alert`) · Co-Passenger Separation · "Depart-first, report-later"
- **Difficulty:** Medium | **Estimated time:** 1 min
- **Steps:**
  1. In the mobile app, select the **[Sensor · Alert Test]** tab and choose an idle vehicle (`Vehicle #06 AL 41F-8890`).
  2. With the **[With Co-Passenger]** checkbox turned on, click the red **`[Unauthorized Start]`** button (start & depart without reporting, `15 km/h+`).
  3. After confirming the bilateral Red Alert, click the **`[Submit Reason]`** button that appears next to it.
- **Verification checklist:**
  - [ ] Does the first KPI card (**🚨 Unauthorized Trips · RED ALERT**) increase by `+1` immediately, and does a red alert marker appear on the radar map?
  - [ ] Even with 2 people in the car, does the system correctly identify the primary driver using **key box BLE (`3 m`) entry order + driver-seat signal strength (`-46 dBm` vs `-74 dBm`)**?
  - [ ] When you click `[Submit Reason]`, does the trip switch to "Depart-first, report-later" and update to normal operation (`AUTHORIZED`)?

---

### 🧪 SCENARIO 04. No-Dashcam Smartphone 6-Axis IMU Crash Reconstruction vs. Mounted-Phone Drop False-Positive Filter
- **Difficulty:** Medium | **Estimated time:** 1 min
- **Steps:**
  1. Go to the middle section of the mobile app's **[Sensor · Alert Test]** tab.
  2. First, click the **`[Phone Drop]`** button on the right.
  3. Then click the amber **`[3.2G Crash]`** button on the left (crash + hard stop).
  4. Check the **[Incidents]** tab in Tab **`2. 30-Fleet Telemetry`** and the **30-second speed-drop graph** on the HUD to the right of the radar map.
- **Verification checklist:**
  - [ ] When you click **[Phone Drop]**, is the event **automatically filtered out as a false positive** because there is no change in driving speed (`Δv = 0 km/h`) despite the `3.4G` impact?
  - [ ] When you click **[3.2G Crash]**, does the combination of `3.24G acceleration + 38.4°/s gyro rotation + hard deceleration (-44 km/h)` generate an actual collision report?

---

### 🧪 SCENARIO 05. Intentional Permission Evasion (`BT_OFF`) Detection & Ghost Trip Discovery via Actual Odometer Audit
- **Difficulty:** Advanced | **Estimated time:** 1 min
- **Steps:**
  1. At the bottom of the mobile app's **[Sensor · Alert Test]** tab, click **`[Toggle BT Permission ON/OFF]`** to put the phone in the `BT_OFF` state.
  2. Click **`[3. Admin Console (PIN)]`** in the top navigation and enter the admin-only 4-digit security PIN (`••••`) to sign in.
  3. In the **[🚗 30 Vehicles · Odometer Audit]** section, enter a number at least `20 km` higher than the current cumulative mileage in a vehicle's `Actual Odometer Audit` field and click **`[Run Audit]`**.
  4. Return to Tab **`2. 30-Fleet Telemetry`** and check the **[Ghost Trips]** tab.
- **Verification checklist:**
  - [ ] As soon as Bluetooth permission is turned off inside the garage, does a **permission-evasion alert** fire and get recorded in the garage entry/exit log?
  - [ ] As soon as an odometer discrepancy (`+5 km` or more) is found, is a **Ghost Trip investigation case** created and is the employee who turned off permissions automatically identified as the **prime suspect (91% confidence)**?

---

### 🧪 SCENARIO 06. Admin 1-Click Preset Setup & Vehicle/User CSV Bulk Upload
- **Difficulty:** Easy | **Estimated time:** 1 min
- **Steps:**
  1. In the Admin Console (security PIN), open the **[🚗 30 Vehicles · Odometer Audit]** section and click **`[📥 Simple CSV Template (Plate & Model Only)]`** to download the CSV file.
  2. Upload the downloaded CSV file as-is with the **`[📤 Vehicle CSV Bulk Upload]`** button. (Confirm that `Vehicle #31 AL 41G-7788 Genesis GV70` is added automatically.)
  3. Click the **[⚙️ Geofence · Sensor · Approval Policy]** section at the top right, then click **`[🟢 Mode A]`** or **`[🔴 Mode C]`** among the 3 one-click preset cards.
- **Verification checklist:**
  - [ ] Even when you upload a CSV containing only plate and model (no Bluetooth MAC address), is **Vehicle #31 automatically mapped and added to the list**?
  - [ ] Without touching any sliders, are **all 9 policies saved and applied instantly with a single click on a preset card**?

---

### 🧪 SCENARIO 07. Real Smartphone (iPhone / Android) Mobile Access & Live 6-Axis IMU Sensor Test
- **Difficulty:** Real-device validation | **Estimated time:** 1 min
- **Steps:**
  1. Open the HTTPS web app URL deployed on Vercel on a real smartphone (Safari or Chrome).
  2. Tap the **`[Connect Phone Sensors]`** button (GPS · 6-axis IMU) at the top of the mobile panel and **[Allow]** the location and motion sensor permissions.
  3. Hold the phone and shake it gently while watching the live **impact (`G-Force`)** and **rotation (`°/s`)** readings change on screen.
- **Verification checklist:**
  - [ ] Are the real smartphone's acceleration (`G`) and gyro rotation (`°/s`) streamed to the screen in real time?
  - [ ] When you shake the phone hard enough to exceed `2.5G`, is an impact packet automatically sent to the backend API (`/api/fleet/telemetry`)?
