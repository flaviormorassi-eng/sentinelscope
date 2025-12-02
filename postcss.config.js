// Explicitly set `from: undefined` to silence PostCSS plugin warnings about a missing source path.
// This mirrors inline Vite config and prevents autoprefixer/tailwind from guessing a filename.
export default {
  from: undefined,
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
