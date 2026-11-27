# Flashcards

Flashcards made from the AI modeling lessons, and a web app to memorize them.

## Language

**Card**:
One thing to memorize, with a stable ID, a version, a type, English source text and, optionally, a German translation.
_Avoid_: Question, flashcard, item

**Card type**:
The kind of Card, which decides what it holds and how it is answered: qa, multiple_choice, formula, numeric, cloze or true_false.
_Avoid_: Kind, format

**Card version**:
A number on a Card that goes up when its content changes, so Reviews of older versions no longer count.
_Avoid_: Revision

**Read aloud**:
How a formula Card's formula is said in words, for example "Norm of a equals the square root of a dot a." Optional. German label: "Gesprochen".
_Avoid_: Pronunciation

**Deck**:
A set of Cards in one file, uploaded to or downloaded from the app.
_Avoid_: Question set, collection

**Review**:
One record of the learner answering one version of one Card: when, how long it took, and whether it was right.
_Avoid_: Result, answer, attempt

**Review log**:
All Reviews, kept as they happened and never changed.
_Avoid_: Results, history

**Statistics**:
Figures computed from the Review log, such as how often a Card was answered right.
_Avoid_: Results, score

**Session**:
One sitting in which the Learner answers a chosen number of Cards, optionally filtered by tag.
_Avoid_: Round, quiz, practice

**Learner**:
The one person using the app.
_Avoid_: User, student
