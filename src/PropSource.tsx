interface Identifiable {
  id: string;
}

interface PropSource {
  next: () => Promise<Identifiable>;
}
