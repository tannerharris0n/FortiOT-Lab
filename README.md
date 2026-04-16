# Fortinet OT Security Demo Controller

> A live OT network security demonstration using a FortiGate Rugged 70F, FortiSwitch Rugged 108F, physical E-Stop panel, and a WLED-controlled LED strip to make abstract IT/OT security concepts physically visible at tradeshows and customer briefings.

![Demo Panel](assets/panel.jpg)

---

## What This Is

Most firewall demos happen entirely on a laptop screen. This demo makes security policy enforcement **physical and visible**:

- A **WS2815 LED strip** acts as a live OT device indicator — green means running normally, red means under threat or halted, amber means warning
- A **physical E-Stop mushroom button** wired into the FortiGate Rugged's digital I/O fires a real automation stitch that kills the LED output and flips the pilot lights — all through the firewall
- A **Node.js app** on your laptop plays the role of a SCADA HMI, showing live Modbus TCP frame traffic in a terminal while FortiGate enforces policy between IT and OT VLANs

When someone hits the E-Stop, the FortiGate logs the event, fires a webhook to the app, fires a second webhook to the LED controller, and flips a physical relay that changes the pilot lights. All of that happens through the security fabric — not around it. That is the story.

---

## Hardware

### Network and Security

| Device | Model | Role |
|---|---|---|
| Firewall | FortiGate Rugged 70F (FGR-70F) | NGFW, OT IPS, IT/OT segmentation, DIO E-Stop input, automation stitches |
| Switch | FortiSwitch Rugged 108F (FSR-108F) | FortiLink-managed, per-port VLAN enforcement, 6x GE RJ45 + 2x SFP |
| Power | Fortinet Rugged PSU | AC to 24VDC for panel hardware, pilot lights, and DIN rail |

### OT Panel — DIN Rail Trainer Stand

Desktop DIN rail trainer stand with:

| Component | Purpose |
|---|---|
| Red mushroom E-Stop (22mm, latching NC) | Wired to FGR-70F DIO IN1+/REF |
| Green pilot light (22mm) | Lit during normal/safe state via DIO NC/COM |
| Red pilot light (22mm) | Lit during alarm/E-Stop via DIO NO/COM |
| Yellow pilot light (22mm) | Optional IPS alert / warning state |
| Toggle switches | Additional demo inputs (future expansion) |
| IEC power inlet + rocker switch | Main panel power |

### LED System

| Component | Model | Notes |
|---|---|---|
| LED Controller | GLEDOPTO Elite ESP32 Ethernet WLED | RJ45 Ethernet + WiFi, 4 outputs, 20A fuse, runs WLED firmware |
| LED Strip | BTF-LIGHTING WS2815 60LED/m 5m IP30 | 12V DC, dual-signal redundancy, individually addressable |
| LED PSU | BTF-LIGHTING 12V 5A 60W ETL | Powers strip and controller |
| Mounting | Aluminum channel with milky diffuser cover | Makes color transitions smooth, professional appearance |

---

## Network Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                          DEMO TABLE                              │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │            FortiSwitch Rugged 108F  (FSR-108F)             │  │
│  │                                                            │  │
│  │  Port 1        Port 2         Port 3         Port 4-6     │  │
│  │ [IT VLAN 10] [FortiLink]   [OT VLAN 20]     [spare]      │  │
│  └─────┬────────────┬───────────────┬────────────────────────┘  │
│        │            │               │                            │
│  ┌─────▼──────┐  ┌──▼────────────┐  ┌──▼─────────────────────┐  │
│  │ Mac Laptop │  │FortiGate      │  │ GLEDOPTO Elite WLED    │  │
│  │            │  │Rugged 70F     │  │ ESP32 Ethernet         │  │
│  │ :3000      │  │               │  │ 192.168.20.50          │  │
│  │ (SCADA HMI)│  │ FortiLink     │  │ RJ45 on FSR-108F       │  │
│  │            │  │ DIO module    │  │ Port 3                 │  │
│  └────────────┘  └──────┬────────┘  └────────────┬───────────┘  │
│  192.168.10.10           │                        │              │
│                    ┌─────▼──────────┐             │ DATA         │
│                    │  OT Panel      │       ┌─────▼──────────┐  │
│                    │                │       │ WS2815 LED     │  │
│                    │  E-Stop        │       │ strip  5m      │  │
│                    │  IN1+ / REF    │       │ aluminum ch.   │  │
│                    │                │       └────────────────┘  │
│                    │  Green light   │                            │
│                    │  NC / COM      │                            │
│                    │                │                            │
│                    │  Red light     │                            │
│                    │  NO / COM      │                            │
│                    └────────────────┘                            │
└──────────────────────────────────────────────────────────────────┘

VLAN layout:
  VLAN 10  (IT)   192.168.10.0/24   Mac laptop  — the "SCADA operator"
  VLAN 20  (OT)   192.168.20.0/24   WLED strip  — the "OT device"

FortiGate enforces every packet that crosses the boundary.
```

---

## DIO Wiring — FortiGate Rugged 70F

The FGR-70F has a physical terminal block with six contacts: NO, COM, NC, IN2+, REF, IN1+.

```
FGR-70F DIO Terminal Block
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   NO  ──────────────────────────  Red pilot light  (+)     │
│                                                             │
│   COM ──────────────────────────  Both pilot lights (-)     │
│                                                             │
│   NC  ──────────────────────────  Green pilot light (+)    │
│                                                             │
│   IN2+ ──────────────────────────  (spare / expansion)     │
│                                                             │
│   REF ──────────────────────────  E-Stop terminal 2        │
│                                                             │
│   IN1+ ─────────────────────────  E-Stop terminal 1        │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Pilot light power:  +24VDC from Fortinet rugged PSU
  Green light loop: NC - COM  (closed = safe, open = alarm)
  Red light loop:   NO - COM  (open = safe, closed = alarm relay fires)

E-Stop button type: Normally Closed (NC), latching, twist-to-release
  Safe state:   IN1+ / REF = closed circuit  →  FortiGate reads: closed
  Alarm state:  IN1+ / REF = open circuit   →  FortiGate reads: open  →  stitch fires
```

**Why Normally Closed?**  
This is standard ICS safety practice (IEC 62443). The circuit is complete during normal operation. If a wire breaks, a connector falls out, or the button is pressed, the circuit opens and the alarm fires. Fail-safe by design.

---

## LED Strip Wiring

```
12V PSU (5A, ETL listed)
    │
    ├── (+12V) ──────────────────  GLEDOPTO V+ screw terminal
    │                                     │
    │                              GLEDOPTO DATA out (GPIO 16)
    │                                     │
    └── (GND)  ──────────────────  GLEDOPTO GND terminal
                                          │
                                          ▼
                                   WS2815 LED Strip
                              ┌──────────────────────┐
                              │  VCC  (+12V)  ──────────── from PSU direct
                              │  DATA         ──────────── from GLEDOPTO IO16
                              │  BACKUP DATA  ──────────── WS2815 dual-signal
                              │  GND          ──────────── common ground
                              └──────────────────────┘

Important: On WS2815 strips VCC connects directly to the 12V PSU,
not through the controller. The controller only carries the data signal.
All GND connections must be tied to a common ground.
```

---

## Software Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                        Mac Laptop                              │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Node.js  (server.js)                    │  │
│  │                                                          │  │
│  │  Express  ──── serves index.html on port 3000            │  │
│  │                                                          │  │
│  │  WebSocket ─── real-time push to browser tab             │  │
│  │                                                          │  │
│  │  POST /webhook ◄──── FortiGate automation stitch         │  │
│  │         │                                                │  │
│  │         ├── maps event fields to scene name              │  │
│  │         └── broadcasts scene via WebSocket               │  │
│  │                                                          │  │
│  │  POST /wled ────────► http://192.168.20.50/json/state    │  │
│  │    (proxy, no CORS)    WLED JSON API                     │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 Browser  (index.html)                    │  │
│  │                                                          │  │
│  │  Sidebar: 10 demo scenarios with one-click triggers      │  │
│  │  State bar: current scene, status, protocol badges       │  │
│  │  Terminal: live Modbus TCP frames (MBAP + PDU + CRC16)   │  │
│  │  Flash overlay: red strobe on E-Stop, IPS flash on alert │  │
│  │  WebSocket listener: receives FortiGate-triggered scenes  │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

## FortiGate Configuration

### DIO input detection

```bash
config system digital-io
    set input1-detection-mode default
    set output-keep-last-state enable
end
```

`default` monitors open/close contact state — correct for an NC E-Stop button.  
`output-keep-last-state enable` holds the relay position across a reboot.

### Verify DIO status

```bash
diagnose digital-io status
```

You should see `IN1: closed` during normal operation with the E-Stop released.

### Automation conditions

```bash
config system automation-condition
    edit "EStop-Open"
        set condition-type input
        set input-state open
    next
    edit "EStop-Closed"
        set condition-type input
        set input-state close
    next
end
```

### Automation actions

**Action — notify the demo app (E-Stop pressed)**
```
Type:    Webhook
URL:     http://<your-mac-ip>:3000/webhook
Method:  POST
Headers: Content-Type: application/json
Body:
{
  "logdesc": "Digital-IO input state change",
  "state": "open",
  "msg": "E-Stop asserted on IN1_REF"
}
```

**Action — kill the LED strip directly**
```
Type:    Webhook
URL:     http://192.168.20.50/json/state
Method:  POST
Body:    {"on":false}
```

**Action — restore on E-Stop release**
```
Type:    Webhook
URL:     http://192.168.20.50/json/state
Method:  POST
Body:    {"on":true,"bri":200,"seg":[{"col":[[0,220,60]]}]}
```

### Automation stitches

| Stitch name | Trigger | Actions |
|---|---|---|
| `EStop-Halt` | `EStop-Open` | Notify app (`state:open`) + Kill strip (`on:false`) |
| `EStop-Reset` | `EStop-Closed` | Notify app (`state:close`) + Restore strip (green) |

### VLAN segmentation policy

```bash
# Policy: allow only the sanctioned SCADA host to reach the OT device
config firewall policy
    edit 12
        set name "SCADA-to-OT-ALLOW"
        set srcintf "vlan10-it"
        set dstintf "vlan20-ot"
        set srcaddr "SCADA-Host"
        set dstaddr "WLED-Controller"
        set action accept
        set service "Modbus-TCP"
        set logtraffic all
    next
    edit 13
        set name "IT-to-OT-DEFAULT-DENY"
        set srcintf "vlan10-it"
        set dstintf "vlan20-ot"
        set srcaddr "all"
        set dstaddr "all"
        set action deny
        set logtraffic all
    next
end
```

---

## Webhook Reference

The server at `POST /webhook` inspects the body and maps FortiGate events to app scenes:

| FortiGate event | Body field | Value | Scene | LED result |
|---|---|---|---|---|
| E-Stop pressed | `state` | `open` | `estop` | Off / dark |
| E-Stop released | `state` | `close` or `closed` | `normal` | Green |
| IPS alert | `msg` or `logdesc` | contains `ips` | `ips` | Red strobe |
| Policy deny | `msg` | contains `deny` or `block` | `block` | Off |
| Custom override | `scene` | any scene name | that scene | varies |

**Test from terminal:**

```bash
# Simulate E-Stop press
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"state":"open","msg":"E-Stop asserted"}'

# Simulate E-Stop release
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"state":"close"}'

# Trigger any scene by name
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"scene":"ips"}'
```

---

## Demo Scenarios

### ✅ All Clear
Baseline normal operation. Strip goes green. Terminal shows a Modbus FC01 coil read of the E-Stop address (0x0010) returning `0x00` — safe and clear. Pilot lights: green ON, red OFF.

**Talking point:** "This is your OT network in a healthy state. Modbus polling is running, the firewall is permitting sanctioned traffic, and the safety input is clear."

---

### 📡 OT Comms Active
A live Modbus polling cycle. The strip cycles through teal/cyan shades while the terminal shows repeated FC16 write-multiple-registers frames — the pattern of a PLC continuously updating an output register.

**Talking point:** "This is what normal OT traffic looks like — predictable, cyclic, low-bandwidth. FortiGate can baseline this behavior and alert on anything that deviates."

---

### ⚠️ IT/OT Boundary Hit
An unauthorized IT host (192.168.10.45) attempts to reach the OT device on port 502. Strip goes amber. Terminal logs a FortiGate deny event with source IP, destination IP, port, and policy ID.

**Talking point:** "An IT workstation tried to reach the OT device directly. FortiGate blocked it and logged it. Without segmentation that connection would have succeeded silently."

---

### 🔍 OT Recon Detected
Five rapid Modbus FC01 coil-read probes stepping through sequential addresses — the pattern of an attacker mapping the OT network. Strip goes amber. Terminal shows FortiGuard IPS signature SID 47391 firing on each probe.

**Talking point:** "This is Modbus reconnaissance. An attacker mapping your OT network before an attack. FortiGuard OT IPS signatures detect this sweep pattern in real time."

---

### 🚨 IPS Alert Fired
A malicious Modbus payload targeting a protected safety PLC coil (0xFF00). Strip goes red and strobes. Screen flashes red. Terminal shows FortiGuard SID 48821, DROP action, and FortiSwitch MAC quarantine via FortiLink.

**Talking point:** "FortiGuard blocked a write to a protected safety register. Then FortiGate instructed the FortiSwitch to quarantine the offending device at the port level — automated response, no human required."

---

### 🛑 E-Stop / Safety Halt

**Physical button path:**  
The FGR-70F DIO module detects IN1/REF opening. Two automation stitch webhooks fire simultaneously — one to this app (triggers scene, screen strobe), one directly to the WLED controller (kills strip). Terminal shows `FGT` rows with the raw FortiGate log event including logid, logdesc, connector, and state fields. DIO relay closes — red pilot light ON, green pilot light OFF.

**App sidebar path:**  
Simulates the same Modbus frame sequence and WLED call without the physical button. Terminal shows a FC01 coil read returning `0xFF` (asserted), then FC16 zeroing all channels.

**Talking point:** "The E-Stop is wired into the firewall's digital I/O. When pressed, FortiGate detects the physical safety input, kills the OT device output over the network, changes the pilot lights via its relay, and logs the safety event to FortiAnalyzer. The physical safety layer and the network security layer responded together through one device."

---

### 🔓 Policy: ALLOW
A sanctioned SCADA host (192.168.10.10) successfully reaches the OT device. Strip goes green. Terminal shows the FC16 write followed by an ACK, with a log line showing policy rule 12 permitting the session.

**Talking point:** "Same network path as the boundary violation demo, but from an authorized source. FortiGate permits it, logs it, and the OT device responds normally."

---

### 🔒 Policy: BLOCK
An unauthorized host (192.168.10.99) attempts a write. The FC16 frame goes out but no ACK returns. Strip goes dark. Terminal shows a timeout and a FortiGate deny log with the exact policy ID.

**Talking point:** "Same Modbus frame, different source IP. FortiGate drops it silently. The OT device never saw the packet. Network obscurity is not a security strategy."

---

### 🔵 Micro-Segmentation
FortiLink VLAN isolation in action. Strip goes blue with a slow pulse. Terminal shows system log lines with the FortiSwitch port configuration: PVID 20, allowed-vlans 20, MAC-auth enforced.

**Talking point:** "The FortiSwitch is managed through the FortiGate — single pane of glass. The OT device's port is locked to VLAN 20. An attacker on the IT VLAN has zero layer-2 visibility to the OT network."

---

### ⬛ Strip Off
Manual output kill. Sends FC16 zeros to all channels. Use to reset between demos.

---

## Full Signal Chain — Physical E-Stop

```
① Person presses the red mushroom button on the DIN rail panel

② E-Stop NC contact opens
   → IN1+ / REF circuit breaks at FGR-70F DIO terminal block

③ FortiGate Rugged 70F detects the state change
   → Writes to FortiAnalyzer:
     logid=0100022907  logdesc="Digital-IO input state change"
     connector="input_IN1_REF"  state="open"
   → DIO relay output activates (NO closes)

④ DIO relay contact change
   → NO/COM closes  →  Red pilot light turns ON
   → NC/COM opens   →  Green pilot light turns OFF

⑤ Automation stitch fires two webhooks simultaneously

   Webhook A  →  http://<mac-ip>:3000/webhook
   Node.js server receives POST body
   Maps "state":"open" to scene "estop"
   Broadcasts via WebSocket to browser
   Browser:
     - Sidebar highlights E-Stop button in red
     - State bar updates: "E-STOP ASSERTED — Safety Halt Active"
     - Terminal logs FGT rows with raw FortiGate event data
     - Screen strobes red for 2 seconds
     - Fires WLED proxy call as confirmation

   Webhook B  →  http://192.168.20.50/json/state
   WLED controller receives  {"on":false}
   LED strip goes dark immediately

⑥ Person twists mushroom button to release

⑦ NC contact restores
   → IN1+ / REF closes
   → FortiGate logs "closed" state change
   → DIO relay deactivates
   → Red pilot light OFF, Green pilot light ON
   → Reset stitch fires:
       App webhook  →  scene "normal"  →  green strip, brief screen flash
       WLED webhook →  {"on":true,"bri":200,"seg":[{"col":[[0,220,60]]}]}

Total time from button press to LED strip dark: < 150ms
```

---

## Running the App

### Prerequisites

```bash
brew install node    # one time
```

### Start

```bash
chmod +x launch.sh   # one time
./launch.sh
```

The script detects your LAN IP, prints the exact FortiGate webhook URL, and opens the browser automatically.

---

## Tradeshow Tips

- Use the Ethernet controller, not WiFi. Show floor 2.4GHz is a warzone.
- Set a static IP on your Mac for VLAN 10. DHCP expiry mid-demo is a problem.
- Mount the LED strip in aluminum channel facing the audience, not behind the hardware facing you.
- Have FortiAnalyzer open in a browser tab. Show the E-Stop log entry appear live.
- Invite an audience member to hit the E-Stop themselves. Let them own it for 30 seconds. They will remember it.

---

## Related Resources

- [WLED JSON API](https://kno.wled.ge/interfaces/json-api/)
- [FGR-70F DIO module docs](https://docs.fortinet.com/document/fortigate/7.6.3/administration-guide/983876/fgr-70f-fgr-70f-3g4g-gpio-dio-module)
- [FortiSwitch Rugged 108F datasheet](https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/FortiSwitchRugged.pdf)
- [FortiGate automation stitches](https://docs.fortinet.com/document/fortigate/7.6.3/administration-guide/139833/automation-stitches)

---

*Built by Tanner Harrison — Fortinet Enterprise SE, Pacific Northwest*  
*[CyberCascadia LLC](https://cybercascadia.com) | Harrison Ventures*
