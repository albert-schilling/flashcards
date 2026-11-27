export function downloadFile(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
