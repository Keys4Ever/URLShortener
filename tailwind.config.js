/** @type {import('tailwindcss').Config} */
export default {
  content: ["./public/*.*"],
  theme: {
    extend: {		
    colors:{
			"card":{
				"border":"#1f2d40",
				"background": "#1f2d4099",
			},
			"button":{
				"background":"#1f2d40",
				"highlight":"#2d415e"
			},
			"text":{
				"muted":"#bcc7d3",
				"primary":"#f8ee33",
				"secondary":"#fdfdc2"
			},
			"nav":"#1f2d40e6",
			"tech":"#2e35411a"
		}
},
  },
  plugins: [],
}

