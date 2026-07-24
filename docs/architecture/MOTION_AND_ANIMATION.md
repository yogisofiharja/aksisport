# Motion & Animation

Motion exists to improve usability.

Never animate for decoration.

---

# Principles

Motion should:

- Explain
- Confirm
- Guide

Motion should never distract.

---

# Inspiration

- Apple
- Linear
- Arc Browser
- Raycast

---

# Motion Types

Screen Transition

Component Transition

Feedback Animation

State Change

Gesture Animation

---

# Allowed Animations

Fade

Scale

Slide

Opacity

Shared Element (future)

---

# Avoid

Bounce

Elastic

Excessive Rotation

Long Delays

Flashing Effects

---

# Button Press

Buttons should provide subtle feedback.

Examples

Scale

Opacity

Elevation

Never combine multiple effects.

---

# Cards

Cards may scale slightly when pressed.

Avoid dramatic animations.

---

# Lists

New items may fade in.

Removed items may fade out.

Avoid complex list choreography.

---

# Modals

Use fade + slide.

Keep duration short.

---

# Bottom Sheets

Use platform-native motion.

Do not invent custom behavior.

---

# Timing

Use motion tokens.

Fast

Normal

Slow

Never hardcode animation duration.

---

# Performance

Animations must remain smooth.

Avoid blocking the JavaScript thread.

Use Reanimated for interactive animations.

---

# Accessibility

Respect reduced motion preferences when supported.

Animations should never prevent interaction.

---

# Philosophy

The best animation is the one users barely notice.