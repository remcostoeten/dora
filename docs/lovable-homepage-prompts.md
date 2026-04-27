# Lovable homepage prompts for Dora

This file contains two complete prompt versions for Dora's homepage. The
first version is practical and conversion-focused. The second version is more
art-directed and gives Lovable more room to push visual ambition. Both versions
preserve the motion-heavy direction of the page, including Three.js and other
interactive elements.

## Practical version

Use this version when you want Lovable to improve the homepage without losing
clarity, conversion, or product focus.

```text
Redesign the entire homepage for Dora as a premium, conversion-focused landing
page.

Important: this is only the homepage. Remove any dashboard, auth, login,
settings, triage-app, or template leftovers from the first screen. The page
must feel like a real product marketing homepage, not a scaffolded app shell.

Dora should read as a modern bug reporting and issue workflow product for
product teams, design teams, and engineers. The homepage must clearly
communicate:
- what Dora is
- who it is for
- why it is better
- what problems it solves
- what the user should do next

Do not use generic copy like "Explore your database faster." Replace it with
messaging that matches Dora's actual product value. The homepage must feel
focused on clarity, speed, and confidence.

Core goals:
1. Make the first 5 seconds instantly understandable.
2. Make the design look expensive, intentional, and distinctive.
3. Use motion and Three.js to support the story, not distract from it.
4. Build a clear conversion path with one primary CTA and one secondary CTA.
5. Cover the full product scope on the homepage, not just one feature.

Homepage structure:
1. Sticky header
2. Hero section
3. Social proof or trust strip
4. Problem and solution section
5. Feature or capability grid
6. Visual workflow section with product imagery or animated demo
7. Benefits or outcomes section
8. Testimonials or credibility section
9. FAQ
10. Final CTA footer

Header direction:
- Keep it clean, minimal, and premium.
- Left: Dora wordmark.
- Center: three nav links max, such as Product, Features, and FAQ.
- Right: two actions max.
- Primary CTA: "Try Dora" or "Book a demo" depending on the best fit.
- Secondary CTA: "Watch demo".
- Make the header sticky on scroll with a subtle blur or background.
- Keep the height compact.
- Make the mobile header collapse cleanly into a drawer or simple menu.
- Do not add a login button unless it is truly essential.

Hero direction:
- Make the hero the strongest part of the page.
- Use a strong headline that states the outcome in plain language.
- Keep the supporting text short and specific.
- Include one primary CTA and one secondary CTA.
- Place a live, animated, or interactive product visual beside or behind the
  copy.
- The hero must hint at the rest of the page, not consume the whole viewport
  with decoration.
- Keep the headline and copy short enough to scan instantly.
- Make the brand or product name visible in the first viewport.

Suggested hero message direction:
- Outcome-based and specific.
- Example tones, not final copy:
  - "Turn bug reports into clear action."
  - "Capture, organize, and resolve issues faster."
  - "One place for the bugs your team actually needs to fix."
- Supporting copy should mention speed, clarity, collaboration, and better
  workflow.

Visual direction:
- Build a distinctive visual system with strong typography, restrained color,
  and premium spacing.
- Avoid generic SaaS beige, purple, or blue-gradient sameness.
- Use a dark, polished base if it suits the brand, but make it rich and
  nuanced, not flat.
- Use one or two accent colors only, and use them with discipline.
- Use subtle texture, depth, and contrast instead of decorative blobs or
  random gradients.
- Avoid card-heavy marketing clutter.
- Avoid oversized floating panels inside floating panels.
- Keep the layout tight, modern, and editorial, but still product-first.

Motion direction:
- Use Three.js where it actually adds value.
- The 3D or interactive hero must feel like a live product artifact, not a
  random scene.
- Motion must be responsive, purposeful, and tied to the message.
- Use staggered reveals, subtle parallax, hover feedback, and layered
  transitions.
- Keep all UI animation interruptible.
- Honor prefers-reduced-motion.
- Animate transform and opacity only where possible.
- Avoid long ambient motion loops that compete with reading.
- Avoid transition-all.
- Make sure the motion helps the page feel premium, but never makes it harder
  to understand.

Recommended hero visual idea:
Create a 3D or interactive centerpiece that feels like a living product
surface:
- a floating bug card system
- a clustered workflow of issue states
- a polished interface panel with subtle depth and ambient movement
- a signal-to-resolution transformation visual

The visual should communicate:
- capture
- clarity
- prioritization
- collaboration
- resolution

Homepage sections:
1. Social proof strip
   Use a restrained row of logos, metrics, or short trust statements. If no
   real logos exist, use product outcomes or numbers.

2. Problem and solution
   Explain the pain Dora solves:
   - bug reports are messy
   - context gets lost
   - teams waste time clarifying
   - priorities are unclear
   Then explain how Dora fixes that.

3. Feature grid
   Show four to six capabilities, each with a strong title and a concise
   explanation.
   Suggested capability themes:
   - fast capture
   - structured reports
   - clear status flow
   - team collaboration
   - analytics or visibility
   - notification or workflow control

4. Workflow section
   Show the actual sequence of how Dora works from report to resolution. This
   section must be visual and easy to scan.

5. Outcomes section
   Translate features into benefits:
   - less back-and-forth
   - faster triage
   - better ownership
   - clearer priorities
   - more confidence for teams

6. Credibility
   Add testimonials, quotes, or a lightweight proof section. If there is no
   real customer proof, use specific product claims and careful visual evidence
   instead of vague marketing language.

7. FAQ
   Include the common objections users would have about adopting Dora.

8. Final CTA
   End with a direct call to action that repeats the core promise.

Copy direction:
- Write in active voice.
- Keep language specific.
- Avoid vague startup phrases like "next-gen," "revolutionary," or "all-in-one"
  unless the page backs them up.
- Do not use filler.
- Make every heading earn its place.
- Buttons should use precise verbs.
- Keep the tone confident, crisp, and modern.

Interaction direction:
- Hover states should feel responsive and polished.
- Buttons should have clear visual hierarchy.
- Links should be obvious without being noisy.
- Any expandable content should animate smoothly and remain readable.
- The page should feel great on desktop and mobile.

Responsive direction:
- The homepage must work on mobile first, not only large screens.
- Text must not overflow or collide with controls.
- The hero should reflow cleanly on narrow widths.
- The 3D area should scale down gracefully and never break the layout.
- Preserve readability over decoration.

Accessibility direction:
- Add visible focus states.
- Use semantic buttons and links.
- Make interactive icons labeled.
- Ensure headings follow a clear hierarchy.
- Keep contrast strong.
- Support reduced motion.

Avoid:
- dashboard UI in the hero
- auth screens
- template content
- tiny unreadable text
- oversized empty whitespace
- generic stock-style SaaS layouts
- overdone gradients
- floating orbs or bokeh
- decorative motion that has no purpose
- a page that feels like a clone of common AI-generated landing pages

Overall vibe:
Dora should feel like a sharp, modern, premium product with a strong opinion.
It should be beautiful, but the beauty must support clarity and conversion.
The homepage should make people immediately understand that Dora helps teams
handle bugs and issues with less friction and more confidence.

Build the homepage as if this is the only page a new user sees before deciding
whether to care.
```

## Art-directed version

Use this version when you want Lovable to push harder on taste, atmosphere, and
visual identity while keeping the homepage coherent and usable.

```text
Redesign Dora's homepage as a high-end, motion-led product landing page.

The page must feel visually premium, technically ambitious, and emotionally
clear. Dora already has heavy animation, Three.js, and other interactive
elements, and this is a strength. Keep that energy, but make every motion
choice serve the product story. The page should feel alive, not noisy.

This is only the homepage. Do not surface dashboard shells, auth screens,
login flows, or template remnants in the first impression. The homepage must
read like a finished brand experience, not a reused app layout.

Dora should feel like a modern product for teams that need to capture, inspect,
understand, and act on issues with less friction. The homepage must make the
product promise obvious before the user reads far.

What the homepage must communicate:
- Dora is a product with a point of view.
- Dora helps teams move from messy signals to clear action.
- Dora is fast, polished, and visually distinctive.
- Dora is useful even before the user understands every feature.
- Dora has enough depth to justify curiosity, not just a pretty first screen.

Design principles:
1. Lead with a sharp message, then reward attention with motion.
2. Treat the hero as a product theatre moment, not a generic SaaS banner.
3. Make the page feel bespoke, not assembled from common landing page parts.
4. Keep the structure simple so the visuals can do real work.
5. Use contrast, scale, depth, and pacing to create a premium feel.

Hero direction:
- Use a concise headline with a strong claim.
- Put the product name in the first viewport.
- Add supporting copy that explains the outcome in plain language.
- Include a primary CTA and a secondary CTA.
- Use a visual that feels like a living interface, not a stock illustration.
- Let the hero breathe, but do not waste space.
- The first fold should already hint at the page's motion language.

Suggested headline direction:
- "Turn issue chaos into clarity."
- "A clearer way to capture and resolve bugs."
- "Move from signal to resolution faster."

Motion direction:
- Use the existing Three.js and interactive system as a signature part of the
  experience.
- Make the motion feel layered, precise, and responsive.
- Use subtle camera movement, depth shifts, hover response, and timed reveals.
- Tie animation to state changes, emphasis, and story beats.
- Keep motion readable on the first pass and rewarding on the second.
- Avoid motion that is ornamental without information value.
- Keep reduced-motion support intact.
- Avoid long loops that compete with the copy.

Recommended hero concept:
Build an interactive 3D composition that feels like a refined product surface:
- floating issue fragments that organize into a clear workflow
- a depth-rich panel showing structured bug data
- a resolution sequence that visually moves from mess to order
- layered UI cards with parallax and lighting depth

The visual should communicate:
- capture
- pattern recognition
- prioritization
- team coordination
- resolution

Section direction:

1. Trust strip
   Use a compact, elegant strip with proof points, metrics, or logos.
   Keep it quiet and credible.

2. Narrative section
   Show the problem as friction, then show Dora as the reduction of that
   friction.
   The copy must be short, concrete, and specific.

3. Capability gallery
   Present four to six capabilities as an editorial grid.
   Each item needs a strong title, one concise sentence, and a visual cue.
   Suggested themes:
   - capture
   - structure
   - collaboration
   - visibility
   - workflow
   - reporting

4. Product motion section
   Use scroll or hover interactions to show Dora in action.
   This section should feel like a sequence, not a static showcase.

5. Outcome section
   Translate product behavior into user value:
   - less context loss
   - faster decision-making
   - cleaner ownership
   - fewer clarifying loops
   - stronger team confidence

6. Proof section
   Add testimonials, metrics, or evidence.
   If real customer proof is limited, focus on specific outcomes and visual
   precision rather than vague claims.

7. FAQ
   Answer the questions a skeptical buyer would ask.
   Keep the answers short and direct.

8. Final CTA
   End with a confident call to action that feels like a natural next step.

Typography direction:
- Use bold hierarchy and strong contrast.
- Make the headline memorable but not decorative.
- Keep body copy tight and readable.
- Do not use oversized type just because the screen is large.
- Do not let text fight with motion.

Color direction:
- Avoid generic startup gradients.
- Use a restrained palette with one strong accent.
- Let shadows, depth, and surface treatment do part of the work.
- Keep the palette distinctive enough that the homepage does not blend into a
  standard AI-generated SaaS look.

Layout direction:
- Keep the page structured and calm.
- Use full-width sections with disciplined inner widths.
- Do not stack card inside card inside card.
- Leave enough negative space for the motion to land.
- Make the scroll story feel intentional from top to bottom.

Conversion direction:
- One primary CTA only.
- One secondary CTA only.
- Repeat the primary CTA at logical breakpoints.
- Make the next step obvious at every major section.

Accessibility and usability:
- Keep focus states visible.
- Preserve semantic structure.
- Label icons and controls.
- Support reduced motion.
- Make the mobile layout clean, stable, and readable.
- Ensure no text overlaps, no clipped controls, and no broken animation on
  smaller screens.

Do not:
- fall back to a generic SaaS homepage pattern
- dilute the motion into decoration
- use placeholder copy
- bury the product story under visual noise
- make the first screen feel like a dashboard
- over-explain the interface
- overuse gradients, blobs, or decorative background effects

Overall target:
Dora should feel like a polished, technically confident, modern product that
uses motion as part of its identity. The homepage must make people feel that
the product is thoughtfully built, visually distinct, and worth exploring.

Make the homepage feel complete, not merely attractive.
```

## Next steps

Use the practical version when you want clearer structure and safer
conversion. Use the art-directed version when you want Lovable to push the
visual system harder while preserving the Three.js-driven identity of the
homepage.
