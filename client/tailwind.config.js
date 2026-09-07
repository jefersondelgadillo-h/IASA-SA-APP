/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        iasa: {
          blue: "#0B4F8A",
          blueDark: "#083A66",
        },
      },
    },
  },
  plugins: [],
};
