# FishAI hardware brief (handoff for physical feasibility and design)

Working name only; no branding work yet. Written 2026-09-21 for whoever is
helping with the physical product (ChatGPT, a contractor, a friend with a
3D printer). The software side is in this repository and is ahead of the
hardware; the point of this brief is to make sure we do not train the AI
on a camera view or a form factor we will never ship.

## The product in one paragraph

A retrofit aquarium lid. It sits on top of an existing tank and carries all
the hardware: the camera(s), the feeder, water sensors, the controller, and
later the switching for lights, air pump and pump modes. It must not
obstruct the view into the tank. It watches the fish continuously, learns
what is normal for each fish, and alerts the owner when something is off.
Reasoning runs on a local model on a PC in the house for now; the lid
itself only needs to capture video, read sensors and actuate.

## What already exists (software, working, tested)

- Video in -> fish detection -> per-fish tracking with persistent ids ->
  behaviour measurements (activity, time near surface / middle / bottom,
  hiding gaps, feeding response) -> SQLite -> per-fish baselines ->
  deviation alerts -> local reasoning model -> a permission-gated action
  layer. Verified on real aquarium footage.
- A live loop that runs unattended on a Windows PC: sessions, a rolling
  video buffer, event clips, a daily review, a dataset export for training.
- Sensor and actuator interfaces with simulators, so hardware can be
  plugged in behind the same interface when it exists.

## The camera decision that shapes everything

The software measures depth (surface vs bottom) from image height, and
identifies fish by the colour and pattern on their flank. Both need a
**side view**: a camera looking horizontally into the tank through the
glass. A pure top-down camera cannot see depth and sees fish as thin
slivers; it is a useful second view, not the first.

The form factor we want to make that work from a lid:

- A rigid arm that comes over the tank rim and runs straight down the
  OUTSIDE of the glass (90 degrees, not angled), with a small camera module
  at its end looking horizontally into the tank.
- Placement on an end pane or a back corner so a 2 to 3 cm strip obstructs
  nothing the owner looks at.
- Camera roughly one third of the tank's height below the rim; a wide lens
  (about 110 to 120 degrees) then covers surface to substrate and, from the
  end pane, the whole length of the tank in one frame.
- The lens pressed against the glass with a foam gasket or a short hood,
  which removes reflections off the outside of the glass. Outside the water
  means no waterproofing and no algae on the lens.
- Optional second camera in the lid looking straight down for horizontal
  position and surface feeding. Record it from day one if it is cheap.

Camera requirements the software cares about: 1080p is plenty, 10 fps is
plenty, manual or lockable focus / exposure / white balance (auto
adjustments change colours and break identity), and infrared night
illumination (fish do not see IR; lights-off behaviour is half the day).
USB is simplest for the first prototype (the PC is in the same room);
an IP camera over Wi-Fi works with the same software.

## What we need from the physical design work

1. **Feasibility of the arm.** Can a lid-mounted arm hold a camera rigidly
   and level against the glass across common rim styles (rimmed glass,
   rimless, acrylic), tank heights of roughly 30 to 60 cm, and glass
   thickness up to 12 mm? Clamp, hook, suction, or magnet through the
   glass? It must not roll (image must stay level).
2. **Lid form factor.** Modular sections to fit common footprints (10, 20,
   29, 40, 55, 75 gallon) or an adjustable frame? Where do the feeder, the
   sensor probes, cable exits and the electronics live so that condensation
   and salt creep do not kill them? Existing light bars have to coexist.
3. **Feeder.** A dry-food dispenser with a repeatable portion, a signal we
   can read so a feeding is timestamped automatically, and a manual button.
   Rotating drum or auger; humidity is the known enemy.
4. **Sensors, in this order.** Water temperature (waterproof probe on a
   lead, DS18B20-style or better), water level (float or non-contact
   ultrasonic from the lid), then pH and dissolved oxygen, which are
   expensive and drift; recommend which are worth it for a consumer product.
5. **Controller and power.** A small board in the lid that streams video
   and sensor readings to the house PC now, and could run the perception
   models on-device later (Raspberry Pi class with a camera, or a Jetson
   class if we go on-device). Mains near water: safety, isolation, and what
   certifications a consumer product would need.
6. **Safe actuation.** Switching a light, an air pump and a pump mode is
   fine through smart plugs or relays; heater control must be bounded in
   hardware as well as software (small setpoint steps, never off). Chemical
   dosing is explicitly out of scope for now.
7. **Cost and build path.** A parts list and rough bill of materials for
   ONE prototype we can build on a bench now, then what changes for a
   short run of ten, then what changes for real production (injection
   moulding vs printed, PCB vs off-the-shelf boards).

## Constraints and things to avoid

- Do not spend time on branding, the mobile app, a dashboard, cloud
  services, or a custom PCB before a bench prototype has recorded a week of
  real footage.
- No chemical dosing, no unattended large temperature changes; these stay
  behind explicit owner approval in the software and should be physically
  impossible for the first hardware.
- Third-party licensing matters: the current fish detector is a bootstrap
  with licence questions, which is why the software is designed to collect
  our own data and replace it. The hardware should make good data easy:
  a fixed, level, glare-free side view is worth more than resolution.

## Open questions we would like an opinion on

- Is a single wide-angle side camera on an end pane enough for tanks up to
  roughly 120 cm long, or do longer tanks need a second side camera?
- Is a lid-mounted top-down camera worth including in version one, given
  surface ripple and light glare, or should it wait?
- Are there existing retrofit lid or feeder products whose mechanical
  approach we should borrow or avoid?
- What is the realistic minimum viable hardware to start recording real
  data next week, using off-the-shelf parts?
