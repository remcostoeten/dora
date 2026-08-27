/*
 * Imported as individual CSS modules instead of @import lines in styles.css:
 * Tailwind's postcss plugin inlines @imports without rebasing url(./files/…),
 * which drops the woff2 assets from the build. As JS imports, each file is
 * processed by the bundler on its own and the font assets are emitted.
 */
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
