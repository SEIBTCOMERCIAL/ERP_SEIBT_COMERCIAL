// O banco devolve no máximo 1.000 linhas por consulta. Para listas que podem
// passar disso (ex.: todos os produtos), busca em páginas até acabar.
// A consulta precisa ter uma ordem estável (ex.: .order("codigo").order("id")).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buscarTodos<T = any>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: any }>
): Promise<T[]> {
  const todos: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await consulta(de, de + 999);
    if (error) throw error;
    todos.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return todos;
}
