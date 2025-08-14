import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-gray-200">404</h1>
        <h2 className="text-2xl font-semibold text-gray-900 mt-4">Página não encontrada</h2>
        <p className="text-gray-600 mt-2 mb-8">
          A página que você está procurando não existe.
        </p>
        <Link href="/">
          <a className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-indigo-600 transition-colors">
            <i className="fas fa-arrow-left mr-2"></i>
            Voltar ao Chat
          </a>
        </Link>
      </div>
    </div>
  );
}