export default function TestStyles() {
  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-blue-500 to-purple-600">
      <h1 className="text-4xl font-bold text-white mb-4">Tailwind CSS Test Page</h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-red-500 text-white p-4 rounded-lg">Red Box</div>
        <div className="bg-green-500 text-white p-4 rounded-lg">Green Box</div>
        <div className="bg-blue-500 text-white p-4 rounded-lg">Blue Box</div>
      </div>

      <div className="glass rounded-xl p-6 mb-4">
        <h2 className="text-2xl font-semibold gradient-text mb-2">Glassmorphism Test</h2>
        <p className="text-gray-700">If you see a blurred glass effect here, custom styles are working!</p>
      </div>

      <div className="bg-gradient-primary text-white p-6 rounded-xl">
        <h3 className="text-xl font-bold">Custom Gradient Test</h3>
        <p>This should show a purple to blue gradient</p>
      </div>

      <div className="mt-8 animate-bounce">
        <button className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors">
          Bouncing Button (Hover Me)
        </button>
      </div>
    </div>
  )
}