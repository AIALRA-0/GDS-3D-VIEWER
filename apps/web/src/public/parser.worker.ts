import { parseGds } from "./gds";
import { parseGltf } from "./gltf";
self.onmessage = (
  event: MessageEvent<{ buffer: ArrayBuffer; name: string; top?: string }>,
) => {
  try {
    const { buffer, name, top } = event.data;
    const layout = /\.(gds|gds2|gdsii)$/i.test(name)
      ? parseGds(buffer, name, top)
      : parseGltf(buffer, name);
    self.postMessage(
      { layout },
      { transfer: layout.layers.flatMap((layer) => [layer.positions.buffer, ...(layer.batches ?? []).flatMap(b => [b.positions.buffer, b.transforms.buffer])]) },
    );
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "无法解析文件",
    });
  }
};
