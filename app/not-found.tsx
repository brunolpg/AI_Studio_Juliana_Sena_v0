import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-800 text-center space-y-4">
        <h1 className="text-4xl font-bold text-teal-600 dark:text-teal-400">404</h1>
        <h2 className="text-xl font-semibold">Página Não Encontrada</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          A página ou recurso solicitado não foi encontrado no sistema.
        </p>
        <Link
          href="/"
          className="inline-block px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Voltar ao Início
        </Link>
      </div>
    </div>
  );
}
