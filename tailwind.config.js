/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: 'class',
	content: [
	  "./pages/**/*.{js,ts,jsx,tsx}",
	  "./components/**/*.{js,ts,jsx,tsx}",
	],
	theme: {
	  extend: {
		colors: {
		  firefli: "#3498db",
		  primary: 'rgb(var(--group-theme) / <alpha-value>)',
		},
	  },
	},
	plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
  };
  