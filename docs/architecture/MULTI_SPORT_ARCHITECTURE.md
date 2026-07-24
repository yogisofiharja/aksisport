# Multi Sport Architecture

AKSI is not a tennis application.

AKSI is a community sports platform.

The architecture must support future sports without redesigning the UI.

---

# Current Sport

Tennis

---

# Future Sports

Padel

Badminton

Pickleball

Table Tennis

Other racket sports

---

# Naming

Never use sport-specific names inside generic UI.

Bad

TennisCard

TennisButton

TennisPlayer

PadelCard

Good

MatchCard

PlayerCard

SessionCard

ActivityCard

ScoreBoard

---

# Sport Engine

Sport-specific logic belongs in a dedicated engine.

Examples

sports/

    tennis/

    padel/

    badminton/

Shared UI should never know sport rules.

---

# Domain Models

Prefer generic terminology.

Good

Match

Player

Team

Court

Score

Set

Round

Session

Avoid sport-specific terminology unless required.

---

# UI

The same MatchCard should display:

Tennis

Padel

Badminton

Only the data changes.

---

# Design System

The Design System should never contain:

TennisButton

PadelCard

BadmintonInput

Keep it completely generic.

---

# Benefits

Adding a new sport should require:

New sport engine

New business logic

Minimal UI changes

---

# Long Term Vision

AKSI should become a reusable platform for community sports.

Not a collection of sport-specific applications.