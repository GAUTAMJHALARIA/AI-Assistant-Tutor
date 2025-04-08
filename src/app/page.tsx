import Link from 'next/link';

export default function Home() {
  const features = [
    {
      icon: '🧮',
      title: 'Math Solver',
      description: 'Draw, upload, or type your math problems and get step-by-step solutions instantly.',
      path: '/math-solver'
    },
    {
      icon: '🎓',
      title: 'Lecture Summarizer',
      description: 'Convert video lectures into comprehensive summaries, quizzes, and study notes.',
      path: '/lecture-summarizer'
    }
  ];

  return (
    <div className="py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to AI Learning Assistant
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Your intelligent companion for mathematics and lecture comprehension.
          Get instant help with math problems and transform lectures into actionable knowledge.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {features.map((feature) => (
          <Link
            key={feature.path}
            href={feature.path}
            className="group p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex flex-col items-center text-center">
              <span className="text-4xl mb-4">{feature.icon}</span>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
                {feature.title}
              </h2>
              <p className="text-gray-600">
                {feature.description}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-16 text-center">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">
          Powered by Advanced AI
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Using state-of-the-art AI models to provide accurate solutions and comprehensive learning materials.
          Start exploring our features to enhance your learning experience.
        </p>
      </div>
    </div>
  );
}
