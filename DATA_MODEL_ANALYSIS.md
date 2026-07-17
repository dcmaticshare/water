# i-Water DCM data-model alignment and risk analysis

## Outcome

The static mock now uses this canonical hierarchy:

**Customer → Location → Project → Unit → Water Project**

The main ownership rule is that a Unit is the physical motherboard boundary. Unit modules, physical input/output ports, and connected components belong to that Unit. A Water Project receives those components through explicit allocation records. This prevents the web application from creating a second, conflicting representation of the physical installation.

The implementation was compared against:

- **boomstructuur volgens DCM.xlsx**, especially Datamodel rows 2–466.
- **schermen 13072026.docx**, all 61 rendered pages / 121 physical screens.

## Application changes

### Complete DCM v2 reflection

The application includes all 465 populated records from the current `Datamodel` sheet. The **DCM Tree** view preserves every hierarchy field from Object through Sub Subtopic and exposes every leaf property with its Excel row, DCM label, data type, maximum length, unit, ID VAE, phase, parent object, and four rights columns.

The Water Project **Connections** view contains all 188 DCM connection records, grouped into five full-width accordions. The **Protocols** view contains all 204 records from both the source categories `Protocol` and `Protocols`, also grouped into five full-width accordions. Sections and nested branches are collapsed by default.

Operational mock cards remain distinct from schema reflection: an Excel field is always visible in the DCM branch even when the mock does not yet simulate that device capability or action.

The mock now persists explicit collections for customers, locations, projects, units, water projects, modules, ports, components, module allocations, port assignments, component allocations, telemetry snapshots, protocol records, notifications, notification acknowledgement events, firmware updates, and simulated commands.

Important behavioral changes:

- Every entity has an immutable ID and explicit foreign key.
- Location is the only source of truth for the address.
- Hardware and ports are owned by the Unit; Water Project screens show an allocation-filtered view.
- A physical port can be assigned only once within a Unit.
- Live values exist only in timestamped telemetry snapshots.
- Measurement controls contain thresholds and setpoints, never duplicated current values.
- Unit status is derived from connectivity, last-seen time, and open notifications.
- FC and ORP are independent nullable channels and can coexist.
- ALKA screens and protocols exist only when compatible hardware is allocated.
- Filtration contains four cycles, matching the device screens.
- Protocol-to-component relationships use IDs rather than display names.
- Notification acknowledgements and reopens append actor/time audit events.
- Test, backwash, refill, calibration, and firmware actions create explicit simulated command events instead of toggling UI state as if hardware had responded.
- Unit time uses an IANA time zone; telemetry and audit events use UTC timestamps.
- Unsupported device families are not exposed as available controls and do not receive invented persistence fields.

## Highest-risk inconsistencies in the supplied model

### 1. Hardware ownership is functionally ambiguous

Most Water Project rows are parented to Unit, but the source mixes connection configuration, protocol configuration, ports, and allocated devices under the Water Project branch. On a real installation, the motherboard owns the physical ports and attached hardware. Nesting those objects directly under a Water Project permits the same physical port or device to be duplicated or reassigned without a central conflict check.

Required production rule: UnitComponent, PhysicalPort, and UnitModule must belong to Unit; ComponentAllocation must link a component to a Water Project.

### 2. Location and Project lack usable identity fields

The Location and Project hierarchy rows define the tree, but do not provide stable IDs and complete field contracts comparable to the lower-level records. Joining by display name will break when a site or project is renamed and makes imports non-idempotent.

Required production rule: immutable primary keys and explicit customerId, locationId, projectId, and unitId foreign keys.

### 3. Legacy field labels are not unique

At least these legacy labels collide:

- **WPP_FC_FL_PS**: pressure-sensor gauge value and flow-sensor gauge value.
- **WPP_WS_AL_AlR**: ALKA alarm settings and ALKA alarm-low value.
- **WPP_LC_StR**: level status for the project/tank variant and the remaining level-control variants.

These collisions make generated APIs, imports, exports, validation messages, and translations ambiguous. Canonical field IDs must be unique; old labels should be retained only as legacy mapping metadata.

### 4. The source contract is incomplete

Within the populated rows, many records lack a UI label or data type, and several phase cells contain a question mark. This prevents deterministic schema generation and makes it impossible to know whether a field is persisted, derived, editable, or merely display-only.

Required production rule: no field enters an implementation contract without a canonical ID, label, type, nullability, ownership, phase, and validation rule.

### 5. Conditional configuration is not modeled

The device screens show optional hardware families, notably ALKA sensing/dosing, and multiple disinfection sensing modes. A flat list of all possible protocol fields does not express whether a protocol is valid for the hardware currently allocated to that Water Project.

Required production rule: validate protocol availability against compatible component allocations. Treat FC and ORP as independent channels; do not encode them as a mutually exclusive boolean mode.

### 6. Telemetry and configuration can be confused

Several device screens display a current measured value beside setpoints, offsets, alarms, and calibration data. If the application stores the current value in protocol/configuration objects as well as telemetry, the two values will drift and threshold badges may evaluate stale data.

Required production rule: one immutable, timestamped telemetry source of truth. Configuration stores only controls, calibration metadata, and references.

### 7. Rights columns are not an authorization model

Free-text rights for i-Water, installer/supervisor, maintenance, and customer do not define action-level permissions, approval requirements, tenancy boundaries, or whether a field is editable versus only visible.

Required production rule: a separate policy matrix for role, action, resource type, field group, tenant scope, and approval workflow. Security decisions must not be inferred from spreadsheet prose.

### 8. Unit and Location data are duplicated

The Unit branch repeats location/address information even though the Unit already belongs to a Project at a Location. Two editable copies will drift.

Required production rule: the web app resolves the current address from Location. A firmware payload may contain a read-only offline snapshot, but that snapshot must not become a second source of truth.

## Other application-level risks

### Status and freshness

A stored online, offline, or alert string will diverge from communication state. Store lastSeenAt, connection state, and notification events; derive the displayed status. Every measured value needs measuredAt and a source Unit.

### Units and data types

Some source rows combine numeric values with display units or use questionable units, such as water-counter values and “maximum filling cycles per day.” Persist numbers in canonical units and format them in the UI. Use L/day for a rate and 1/day for a cycle frequency.

### Date and time

Independent date, time, and time-zone fields can represent impossible or contradictory states. Persist timestamps in UTC and store the Unit IANA zone (for example Europe/Brussels) for local schedules and display.

### Screen lock and secrets

The physical UI includes a numeric screen code and communication credentials. A boolean “lock enabled” is not sufficient, but the code/password must never be returned to the browser as plaintext. Store only an enabled flag and a salted verifier on the trusted device/backend boundary.

### Notification audit

A mutable acknowledged flag loses who acknowledged an event, when it happened, and whether it was reopened. Use append-only acknowledgement/reopen events.

### Firmware workflow

Firmware cannot be represented safely by a single “updated” flag. Use states such as available, scheduled, downloading, verifying, installing, completed, and failed, with version, progress, timestamps, and failure details.

### Deletion behavior

The source does not define what should happen when a Location, Project, Unit, Water Project, component, or allocation is removed. Production deletion should normally be restricted or archived, with a dependency preview and an explicit migration/reassignment workflow.

### Naming and vocabulary

The source contains inconsistent vocabulary such as Protocol/Protocols, spelling variants of disinfection, and overlapping meanings for Project versus Water Project. Canonical enum values and UI aliases are needed; the application should consistently reserve Project for the grouping object and Water Project for the managed body of water.

### Workbook hygiene

The workbook contains a nearly empty Sheet1, trailing blank formatted rows, and extra used-range columns. These do not change the domain, but they complicate automated imports and can make row-count checks misleading.

## Device features without a complete data contract

The physical screens expose feature families that are absent or incomplete in the supplied workbook and previous mock:

- Chemical parameters
- Cover
- Lights
- Water flows
- Water features
- Sustainability / energy-related controls

The DCM Tree may display these families when they occur in the source workbook, but the operational interface does not advertise them as available controls. They should not be persisted until their ownership, fields, types, supported multiplicity, protocols, permissions, and validation rules are specified.

## Recommended next production decisions

1. Approve the Unit-owned hardware and allocation model as the canonical domain boundary.
2. Assign canonical immutable IDs to every entity and field; keep DCM labels only as import aliases.
3. Complete missing labels, types, phase values, nullability, and validation rules.
4. Define the action-level authorization and approval matrix.
5. Define dependency-aware archive/delete behavior.
6. Complete the device contract for the six feature families listed above.
7. Specify command delivery semantics and device acknowledgements for real hardware integration.
8. Version the schema and import mappings so future DCM workbook changes can be migrated explicitly.
