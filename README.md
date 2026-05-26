\# Quiz Quest: Multiplayer Edition



> Real-time multiplayer quiz game for classrooms and immersive display rooms.  

> Supports gamepads, keyboard, and phone browsers simultaneously — no app install required.  

> Built for Igloo CAVE environments. Runs on any screen.



!\[Quiz Quest Screenshot](docs/screenshots/screenshot1.png)



\*\*Status:\*\* Live in FE curriculum · \*\*Version:\*\* 0.1.3 · \*\*Engine:\*\* Unity (C#)



\---



\## Overview



The host loads a question bank and creates a room. Players join via gamepad, 

keyboard, or phone — all simultaneously. Questions run on a timer, answers 

flash correct/wrong in real time, scores update live, and a full PDF report 

generates automatically at the end of the session.



Designed for Igloo CAVE 360° projection environments. Works on any display.



\---



\## How Players Join



\*\*Gamepad\*\* — Xbox or PlayStation. A/B/X/Y map to the four answer options.  

Squeeze trigger on setup screen to identify your controller.



\*\*Keyboard\*\* — R / T / Y / U keys for options A / B / C / D.



\*\*Phone\*\* — Scan the QR code on screen. Enter a name, pick an avatar, tap answers.  

No app install. Works on any smartphone browser.



All three input methods work simultaneously in the same session.



\---



\## Web Phone Mode — Backend Options



| Backend | Best for |

|---------|----------|

| \*\*Local\*\* | LAN events — fast, no internet, phones on same Wi-Fi |

| \*\*Render\*\* | Cloud relay — host and players on different networks |

| \*\*Firebase\*\* | Campus guest Wi-Fi or mixed networks |



\---



\## Firebase Setup (Safe for Public Repo)

1. Copy `WebControllerServer/public/firebase-config.local.example.js` to `WebControllerServer/public/firebase-config.local.js`
2. Put your real Firebase values in `firebase-config.local.js`
3. Keep `WebControllerServer/public/firebase-config.js` as the committed placeholder file

`firebase-config.local.js` is git-ignored to prevent key leaks.

\---



\## Features



\- Mixed input — gamepads, keyboard, and phones simultaneously

\- QR code phone join, no app install required

\- Room cap of 36 players (configurable)

\- Live player list with avatars and answer status

\- \*\*Streak lifelines\*\* — after 3 correct answers: 50/50, Skip, or Double points

\- \*\*Speed bonus\*\* — answering in the first 30% of the timer earns extra points

\- \*\*Prediction poll\*\* — vote YES/NO before the reveal; correct predictions earn a bonus

\- \*\*Answer heatmap\*\* — phones show a bar chart of how players voted after each question

\- Emoji reactions between questions

\- Easy / Medium / Hard difficulty filtering with category-progressive rounds

\- Auto-generated PDF and TXT reports at session end

\- Igloo CAVE multi-display support (6-projector configuration)



\---



\## Quiz File Format



Quiz files are plain JSON arrays. Drop them in the `Quizzes/` folder next to the build.



```json

\[

&#x20; {

&#x20;   "question": "What is the capital of France?",

&#x20;   "options": \["Berlin", "Madrid", "Paris", "Rome"],

&#x20;   "correctAnswerIndex": 2,

&#x20;   "category": "easy",

&#x20;   "remarks": "Paris has been the French capital since 987 AD.",

&#x20;   "image": "QuizImages/geography/france.png"

&#x20; }

]

```



See \[`sample-quiz.json`](sample-quiz.json) for a working example.



\*\*Required:\*\* `question`, `options` (exactly 4), `correctAnswerIndex` (0–3)  

\*\*Optional:\*\* `category`, `remarks`, `image`, `optionImages`



\---



\## Controls Reference



| Answer | Keyboard | Gamepad |

|--------|----------|---------|

| Option A | R | Button South (A / Cross) |

| Option B | T | Button East (B / Circle) |

| Option C | Y | Button West (X / Square) |

| Option D | U | Button North (Y / Triangle) |



\---



\## Screenshots

!\[Config screen](docs/screenshots/screenshot2.png)

!\[Setup screen](docs/screenshots/screenshot3.png)

!\[Waiting Screen](docs/screenshots/screenshot4.png)

!\[Question round](docs/screenshots/screenshot5.png)

!\[Score display](docs/screenshots/screenshot6.png)





\---



\## Architecture Notes



The phone web UI (`web-controller/public/`) is a standalone HTML/JS frontend.  

It communicates with the Unity host via WebSocket (Local/Render) or Firebase Realtime Database.  

The local backend is a small Node.js server bundled with the build.  

The Unity side uses the New Input System for controller management and  

QuestPDF (via NuGetForUnity) for PDF report generation.



\---



\## Source Code



The Unity project source is closed. This repository contains the phone web  

controller UI and sample quiz files.



\*\*Full project writeup:\*\* \[sagorahamed.com](https://sagorahamed.com/project.php?slug=quiz-quest-local-multiplayer-edition)



\---



\## Tech Stack



`Unity (C#)` · `Igloo Toolkit` · `Meta Quest 3` · `Unity New Input System`  

`QuestPDF` · `NuGetForUnity` · `Node.js` · `Firebase Realtime Database` · `WebSocket`



\---



\## Developer



\*\*Sagor Ahamed\*\* — Game Developer \& XR Specialist  

MSc Games \& Extended Reality, University of Salford (2024)  

Digital Innovation Technician, Wigan \& Leigh College



\[Portfolio](https://sagorahamed.com) · \[LinkedIn](https://linkedin.com/in/sagor59)

