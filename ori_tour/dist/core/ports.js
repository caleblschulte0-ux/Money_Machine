// THE PORTING CONTRACT.
//
// Everything a device must provide to run an ORI tour is declared here. The
// core (src/core) never touches a screen, a speaker, a sensor API, the
// network or a timer directly; it only calls these interfaces. A new device
// (a phone browser, Meta Ray-Ban Display, Snap Spectacles in Lens Studio, an
// Android app for XREAL or RayNeo) is a set of adapters implementing them,
// plus a Display that draws the device-neutral ViewModel.
//
// src/web/ implements all of them for browsers. docs/PORTING.md walks through
// each one for Lens Studio and Android.
//
// Units, everywhere: time in milliseconds on one monotonic-enough clock,
// angles in degrees clockwise from TRUE north, distances in metres,
// acceleration in m/s^2.
export {};
