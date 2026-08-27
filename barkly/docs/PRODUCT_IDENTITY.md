# Barkly — Product Identity

## The one-sentence product

**Barkly is not an AI chatbot shaped like a dog. He is a dog who becomes different because of what you do together.**

Talking is table stakes. The moat is accumulated relationship state: private jokes, learned routines, recurring friends and enemies, favorite junk, grudges, memories, habits, and a personality that is visibly different six months later because this particular person raised him.

The app should pass one test before a feature earns complexity:

> Could two people use this feature for a month and end up with noticeably different Barklys?

If the answer is no, it is probably content, polish, or a commodity feature — useful sometimes, but not the center of Barkly.

---

## Pillar 1 — You teach Barkly

Most character apps arrive programmed. Barkly should feel **trainable**.

A person can say:

- “When I say intruder alert, freak out.”
- “When I say showtime, spin, sit, then play dead.”
- “When I say bedtime, look at me, wag once, then go to sleep.”

The result is stored as Barkly behavior, not merely remembered prose. Repeating the cue later triggers the learned performance without needing the model again.

### Why this matters

The user is authoring the character. A ridiculous routine becomes a private joke. Repetition turns it into a ritual. The same device-agnostic routine contract can eventually drive motors in the physical toy, which means training learned in the app can become training the physical Barkly already knows.

### Direction

- v1: 1–4 ordered body-action beats.
- next: timing, pauses, repeated beats, gesture intensity.
- later: user-created names for routines, favorite routines, chaining routines together.
- physical Barkly: routine actions map to servos/speaker rather than screen animation.

---

## Pillar 2 — The relationship has an identity

The **Pack Book** answers the question: “What kind of Barkly did I create?”

It is not a skill tree and not a personality quiz. It is derived from what actually happened.

Examples:

- A person who talks constantly and teaches commands may grow a **Coach & Confidant** Barkly.
- A person who digs everywhere and explores grows **Dirt-Digging Legends**.
- A person who teaches nonsense and spends all day with recurring NPC dogs can end up **Certified Menaces**.
- A highly bonded, heavily trained Barkly can become a **Velcro Apprentice**.

The labels are not merely badges. Relationship texture is fed back into the dialogue context so Barkly naturally talks like the history is real.

### Pack Book sections

- Bond stage: Just Met → Buddies → Packmates → Best Friends → Basically Family.
- Emergent traits: trainer, confidant, adventurer, collector, socialite, velcro dog.
- Private rituals: commands used often enough to become shared traditions.
- Our lore: friendships, rivalries, treasure mythology, current obsessions.
- Core memories: the few experiences most worth keeping on the highlight reel.

The user should eventually be able to show this screen to a friend and have it function like a weird little friendship yearbook.

---

## Pillar 3 — Recurring characters become relationships

NPCs must not be vending machines for lines.

Seeing Biscuit six times should be meaningfully different from meeting Biscuit once. Duke irritating Barkly repeatedly should create history rather than replaying the same encounter forever.

Current relationship ladder:

### Friends

1. Park acquaintance
2. Actual buddy
3. Best friend
4. Pack family

### Rivals

1. Annoying dog
2. Official rival
3. Nemesis
4. Generational feud

These relationships become prompt context, initiative material, and Pack Book lore.

### Direction

Recurring dogs should eventually:

- remember specific incidents,
- have changing opinions of Barkly,
- ask Barkly for favors,
- create multi-session story arcs,
- reconcile or escalate,
- react to Barkly's learned routines,
- have relationships with one another independent of the player.

The town should become a tiny soap opera the player helped cause.

---

## Pillar 4 — Private rituals turn usage into lore

A feature becomes emotionally powerful when the app stops treating repetition as repetition.

If a user has said “intruder alert” six times, the product should no longer describe it as a command used six times. It should become **The Intruder Alert Tradition**.

That framing is the difference between a database and a relationship.

Other ritual candidates later:

- a phrase the user always says when opening the app,
- a repeated bedtime routine,
- the same place visited every Saturday,
- a nickname Barkly and the user keep using,
- a specific friend they always greet first,
- a favorite treasure they refuse to replace.

Rituals are a strong retention mechanic because they are not artificial streaks. The user comes back because something that only exists between them is waiting there.

---

## Pillar 5 — Barkly has initiative

Barkly should sometimes have a reason to bother the user.

Not notifications for engagement. Actual character initiative:

- “You said we were playing yesterday. I remember things.”
- “Duke is here. That's my nemesis. Their choices led us here.”
- “We have five treasures now. That's a collection.”
- “Do you still like the blue car you told me about?”

The important property is causality. Barkly says something because of history, not because a random timer selected canned dialogue.

---

# What Barkly should NOT become

## Not Talking Tom with an LLM

Voice chat plus feeding plus a store is easy to copy and easy to forget.

## Not a Tamagotchi spreadsheet

Mood and hunger support character behavior. They should not become chores where missing a day feels like failing a child.

## Not a generic AI friend wearing dog art

The AI is machinery. The product is the persistent creature and the relationship model around it.

## Not a content treadmill

We should not need hundreds of handcrafted quests every month just to keep Barkly alive. Systems should combine into stories automatically.

---

# Large-scale feature roadmap

## 1. The Barkly Story Engine

Create small multi-session arcs from existing world state instead of fixed quest chains.

Example:

- Duke steals Barkly's favorite stick.
- Barkly complains later at home.
- Biscuit offers bad advice the next park visit.
- User can tell Barkly to forgive Duke, confront Duke, or steal something back.
- That decision permanently changes social history.

The story exists because of this user's relationships and possessions, so another user's arc is different.

## 2. Naming things changes their importance

Let the user name treasures, toys, routines and maybe locations/corners of the room. Named objects become more important in memory and dialogue.

A random rock is content. **Sir Rockington**, which Barkly has protected for three months, is lore.

## 3. Barkly invents things back

The relationship should become bidirectional. Once bond is high enough, Barkly can create a nickname for the user, invent a name for a routine, declare a treasure sacred, or decide that a specific chair is “his.”

The user raises Barkly; Barkly also authors the relationship.

## 4. Shared world / Barkly meets Barkly

Eventually two users' Barklys should be able to meet with their accumulated identities intact.

The interesting object is not an avatar skin. It is:

- what each Barkly has learned,
- who each Barkly likes,
- what each Barkly is afraid of,
- their signature routine,
- their favorite treasure,
- their owner's running jokes.

A playdate between two highly divergent Barklys should feel like two characters meeting, not two accounts connecting.

## 5. App → physical toy continuity

This is the long-term killer feature.

A physical Barkly should not arrive as a reset. Pair it with the app and the dog the user already raised moves into the toy:

- same name and memories,
- same relationships,
- same favorite things,
- same private cues,
- same signature routines,
- same grudges and personality drift.

The sell is not “an AI plush dog.”

The sell is: **the Barkly you already know can step out of the screen.**

---

# Current product thesis

The strongest version of Barkly is a **relationship engine disguised as a dog**.

The dog should become hard to replace not because the user has accumulated currency, but because switching to a new virtual pet would mean losing the one that knows the joke, hates Duke for a reason, performs the stupid routine, calls a rock by its name, and remembers what happened three months ago.

That is the moat.
