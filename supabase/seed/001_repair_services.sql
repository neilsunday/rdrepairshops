-- Source catalog: the public website Services section in index.html.
-- This catalog contains 50 active service entries and no product prices.
-- The source rows are keyed by a stable slug, and reruns are safe because the seed uses
-- an explicit ON CONFLICT (slug) DO NOTHING guard. Do not add price values that are not
-- present in the source catalog or in the normalized SQL schema.

BEGIN;

INSERT INTO public.repair_services (slug, name, category, description, status, sort_order)
VALUES
  ('lcd-replacement', 'LCD Replacement', 'Display and Screen', 'Replace a damaged LCD panel causing lines, dark areas, or image loss.', 'active', 1),
  ('screen-replacement', 'Screen Replacement', 'Display and Screen', 'Replace damaged screen components after the display issue is assessed.', 'active', 2),
  ('touchscreen-repair', 'Touchscreen Repair', 'Display and Screen', 'Diagnose unresponsive, inaccurate, or intermittent touch input.', 'active', 3),
  ('backlight-repair', 'Backlight Repair', 'Display and Screen', 'Diagnose a dim or dark screen when display illumination is affected.', 'active', 4),
  ('display-connector-repair', 'Display Connector Repair', 'Display and Screen', 'Repair a damaged connection between the display and device board.', 'active', 5),
  ('screen-protector-installation', 'Screen Protector Installation', 'Display and Screen', 'Install a screen protector to help shield the display surface.', 'active', 6),
  ('battery-replacement', 'Battery Replacement', 'Battery, Charging, and Power', 'Replace a worn battery associated with rapid drain or unexpected shutdowns.', 'active', 7),
  ('charging-port-replacement', 'Charging Port Replacement', 'Battery, Charging, and Power', 'Replace a worn or damaged port that prevents a reliable charging connection.', 'active', 8),
  ('charging-ic-repair', 'Charging IC Repair', 'Battery, Charging, and Power', 'Diagnose charging faults related to charging-control circuitry.', 'active', 9),
  ('power-ic-repair', 'Power IC Repair', 'Battery, Charging, and Power', 'Diagnose power issues related to power-management circuitry.', 'active', 10),
  ('battery-connector-repair', 'Battery Connector Repair', 'Battery, Charging, and Power', 'Repair a damaged connection between the battery and device board.', 'active', 11),
  ('charging-flex-replacement', 'Charging Flex Replacement', 'Battery, Charging, and Power', 'Replace a damaged flexible cable assembly involved in charging.', 'active', 12),
  ('fast-charging-repair', 'Fast Charging Repair', 'Battery, Charging, and Power', 'Diagnose a device that no longer charges at its supported fast-charge rate.', 'active', 13),
  ('wireless-charging-repair', 'Wireless Charging Repair', 'Battery, Charging, and Power', 'Diagnose charging problems with a device''s wireless charging function.', 'active', 14),
  ('no-power-dead-boot-repair', 'No Power / Dead Boot Repair', 'Battery, Charging, and Power', 'Inspect a device that will not power on or complete its startup sequence.', 'active', 15),
  ('phone-overheating-diagnosis', 'Phone Overheating Diagnosis', 'Battery, Charging, and Power', 'Inspect possible causes when a phone becomes unusually hot.', 'active', 16),
  ('power-button-repair', 'Power Button Repair', 'Buttons, Frame, and External Parts', 'Diagnose a sticking, damaged, or unresponsive power button.', 'active', 17),
  ('volume-button-repair', 'Volume Button Repair', 'Buttons, Frame, and External Parts', 'Diagnose volume buttons that stick or do not respond consistently.', 'active', 18),
  ('back-cover-replacement', 'Back Cover Replacement', 'Buttons, Frame, and External Parts', 'Replace a cracked, damaged, or detached rear cover.', 'active', 19),
  ('phone-frame-replacement', 'Phone Frame Replacement', 'Buttons, Frame, and External Parts', 'Replace a damaged or bent device frame after inspection.', 'active', 20),
  ('button-flex-replacement', 'Button Flex Replacement', 'Buttons, Frame, and External Parts', 'Replace a damaged flex cable connecting the physical buttons.', 'active', 21),
  ('sim-tray-replacement', 'SIM Tray Replacement', 'Buttons, Frame, and External Parts', 'Replace a bent, damaged, or missing SIM tray.', 'active', 22),
  ('vibration-motor-replacement', 'Vibration Motor Replacement', 'Buttons, Frame, and External Parts', 'Replace a vibration motor that no longer provides reliable feedback.', 'active', 23),
  ('flashlight-repair', 'Flashlight Repair', 'Buttons, Frame, and External Parts', 'Diagnose a rear flashlight that will not turn on or work consistently.', 'active', 24),
  ('camera-replacement', 'Camera Replacement', 'Cameras', 'Replace an affected camera module after the issue is assessed.', 'active', 25),
  ('front-camera-repair', 'Front Camera Repair', 'Cameras', 'Inspect image, focus, or operation issues with the front camera.', 'active', 26),
  ('back-camera-repair', 'Back Camera Repair', 'Cameras', 'Inspect image, focus, or operation issues with the rear camera.', 'active', 27),
  ('camera-glass-replacement', 'Camera Glass Replacement', 'Cameras', 'Replace cracked or damaged glass covering a camera lens.', 'active', 28),
  ('rear-camera-lens-replacement', 'Rear Camera Lens Replacement', 'Cameras', 'Replace a damaged rear camera lens component after inspection.', 'active', 29),
  ('speaker-repair', 'Speaker Repair', 'Audio', 'Diagnose distorted, quiet, or missing sound from the loudspeaker.', 'active', 30),
  ('earpiece-replacement', 'Earpiece Replacement', 'Audio', 'Replace an earpiece speaker affected by low or absent call audio.', 'active', 31),
  ('microphone-repair', 'Microphone Repair', 'Audio', 'Diagnose microphone pickup problems during calls or recordings.', 'active', 32),
  ('audio-ic-repair', 'Audio IC Repair', 'Audio', 'Inspect audio faults that may relate to device audio circuitry.', 'active', 33),
  ('fingerprint-sensor-repair', 'Fingerprint Sensor Repair', 'Sensors and Biometrics', 'Diagnose a fingerprint reader that does not respond reliably.', 'active', 34),
  ('face-id-face-unlock-repair', 'Face ID / Face Unlock Repair', 'Sensors and Biometrics', 'Troubleshoot device components involved in face-based unlocking.', 'active', 35),
  ('proximity-sensor-repair', 'Proximity Sensor Repair', 'Sensors and Biometrics', 'Diagnose proximity sensing problems, including during calls.', 'active', 36),
  ('ambient-light-sensor-repair', 'Ambient Light Sensor Repair', 'Sensors and Biometrics', 'Inspect automatic brightness issues related to light sensing.', 'active', 37),
  ('sim-card-reader-repair', 'SIM Card Reader Repair', 'Connectivity', 'Inspect a SIM reader that does not consistently detect a card.', 'active', 38),
  ('memory-card-slot-repair', 'Memory Card Slot Repair', 'Connectivity', 'Inspect memory card slot connection issues on devices with removable storage.', 'active', 39),
  ('network-signal-repair', 'Network Signal Repair', 'Connectivity', 'Diagnose weak or missing mobile network signal reception.', 'active', 40),
  ('wi-fi-repair', 'Wi-Fi Repair', 'Connectivity', 'Inspect problems connecting to or maintaining a Wi-Fi connection.', 'active', 41),
  ('bluetooth-repair', 'Bluetooth Repair', 'Connectivity', 'Diagnose Bluetooth pairing or connection problems.', 'active', 42),
  ('motherboard-repair', 'Motherboard Repair', 'Motherboard and Water Damage', 'Diagnose board-level faults affecting device operation.', 'active', 43),
  ('motherboard-component-replacement', 'Motherboard Component Replacement', 'Motherboard and Water Damage', 'Replace an identified board-mounted component after diagnosis.', 'active', 44),
  ('water-damage-repair', 'Water Damage Repair', 'Motherboard and Water Damage', 'Assess liquid exposure, inspect affected parts, and discuss next steps.', 'active', 45),
  ('software-troubleshooting', 'Software Troubleshooting', 'Software and Data', 'Diagnose operating system and app software problems.', 'active', 46),
  ('operating-system-reinstallation', 'Operating System Reinstallation', 'Software and Data', 'Reinstall a supported device operating system when software faults require it.', 'active', 47),
  ('bootloop-repair', 'Bootloop Repair', 'Software and Data', 'Inspect a device that repeatedly restarts before its system loads.', 'active', 48),
  ('phone-stuck-on-logo-repair', 'Phone Stuck on Logo Repair', 'Software and Data', 'Diagnose a device that stops at its startup logo.', 'active', 49),
  ('data-recovery', 'Data Recovery', 'Software and Data', 'Assess options for retrieving data based on device condition and fault.', 'active', 50)
ON CONFLICT (slug) DO NOTHING;

-- Verification queries for the local source catalog and the imported seed:
-- 1) Rows imported into the database must match the source catalog count.
SELECT COUNT(*) AS total_seed_rows
FROM public.repair_services;

-- 2) Duplicate slugs are not allowed; zero rows should be returned below.
SELECT slug, COUNT(*) AS duplicate_count
FROM public.repair_services
GROUP BY slug
HAVING COUNT(*) > 1;

-- 3) Compare the imported catalog against the approved source list in index.html.
-- Expected: 50 active rows, 50 unique slugs, and no unreviewed price columns.
SELECT status, COUNT(*) AS rows_by_status
FROM public.repair_services
GROUP BY status
ORDER BY status;

COMMIT;
