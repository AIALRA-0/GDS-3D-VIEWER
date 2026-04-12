from __future__ import annotations

from pathlib import Path

import gdspy
import numpy as np
import pygltflib
import triangle
from pygltflib import BufferFormat


DEFAULT_LAYERSTACK: dict[tuple[int, int], dict[str, object]] = {
    (235, 4): {"name": "substrate", "zmin": -2.0, "zmax": 0.0, "color": [0.18, 0.18, 0.18, 1.0]},
    (64, 20): {"name": "nwell", "zmin": -0.5, "zmax": 0.01, "color": [0.37, 0.37, 0.37, 1.0]},
    (65, 20): {"name": "diff", "zmin": -0.12, "zmax": 0.02, "color": [0.93, 0.93, 0.93, 1.0]},
    (66, 20): {"name": "poly", "zmin": 0.0, "zmax": 0.18, "color": [0.79, 0.35, 0.43, 1.0]},
    (66, 44): {"name": "licon", "zmin": 0.0, "zmax": 0.936, "color": [0.25, 0.25, 0.25, 1.0]},
    (67, 20): {"name": "li1", "zmin": 0.936, "zmax": 1.136, "color": [0.91, 0.75, 0.48, 1.0]},
    (67, 44): {"name": "mcon", "zmin": 1.011, "zmax": 1.376, "color": [0.25, 0.25, 0.25, 1.0]},
    (68, 20): {"name": "met1", "zmin": 1.376, "zmax": 1.736, "color": [0.17, 0.42, 0.88, 1.0]},
    (68, 44): {"name": "via", "zmin": 1.736, "zmax": 2.0, "color": [0.25, 0.25, 0.25, 1.0]},
    (69, 20): {"name": "met2", "zmin": 2.0, "zmax": 2.36, "color": [0.64, 0.74, 0.91, 1.0]},
    (69, 44): {"name": "via2", "zmin": 2.36, "zmax": 2.786, "color": [0.25, 0.25, 0.25, 1.0]},
    (70, 20): {"name": "met3", "zmin": 2.786, "zmax": 3.631, "color": [0.18, 0.62, 0.86, 1.0]},
    (70, 44): {"name": "via3", "zmin": 3.631, "zmax": 4.0211, "color": [0.25, 0.25, 0.25, 1.0]},
    (71, 20): {"name": "met4", "zmin": 4.0211, "zmax": 4.8661, "color": [0.18, 0.15, 0.41, 1.0]},
    (71, 44): {"name": "via4", "zmin": 4.8661, "zmax": 5.371, "color": [0.25, 0.25, 0.25, 1.0]},
    (72, 20): {"name": "met5", "zmin": 5.371, "zmax": 6.6311, "color": [0.46, 0.46, 0.46, 1.0]},
}


def convert_gds_to_gltf(
    input_path: Path,
    output_path: Path,
    layerstack: dict[tuple[int, int], dict[str, object]] | None = None,
) -> Path:
    layerstack = layerstack or DEFAULT_LAYERSTACK

    gdsii = gdspy.GdsLibrary()
    gdsii.read_gds(str(input_path), units="import")

    gltf = pygltflib.GLTF2()
    scene = pygltflib.Scene(nodes=[])
    gltf.scenes.append(scene)
    buffer = pygltflib.Buffer()
    gltf.buffers.append(buffer)

    for layer in layerstack.values():
        material = pygltflib.Material()
        material.doubleSided = False
        material.name = str(layer["name"])
        material.pbrMetallicRoughness = {
            "baseColorFactor": layer["color"],
            "metallicFactor": 0.45,
            "roughnessFactor": 0.55,
        }
        gltf.materials.append(material)

    binary_blob = bytes()
    meshes_lib: dict[str, int] = {}

    for cell in gdsii.cells.values():
        if cell.name == "$$$CONTEXT_INFO$$$":
            continue

        layers: dict[tuple[int, int], list[tuple[np.ndarray, dict, bool]]] = {}

        for path in cell.paths:
            layer_number = (path.layers[0], path.datatypes[0])
            if layer_number not in layerstack:
                continue
            layers.setdefault(layer_number, [])
            for poly in path.get_polygons():
                layers[layer_number].append((poly, {}, False))

        for polygon in cell.polygons:
            layer_number = (polygon.layers[0], polygon.datatypes[0])
            if layer_number not in layerstack:
                continue
            layers.setdefault(layer_number, [])
            for poly in polygon.polygons:
                layers[layer_number].append((poly, {}, False))

        for layer_number, polygons in layers.items():
            if not polygons:
                continue

            for index, (polygon, _, _) in enumerate(polygons):
                point_count = len(polygon)
                area = 0.0
                for i, vertex_1 in enumerate(polygon):
                    vertex_2 = polygon[(i + 1) % point_count]
                    area += (vertex_2[0] - vertex_1[0]) * (vertex_2[1] + vertex_1[1])

                clockwise = area > 0

                delta = 0.00001
                points_i = polygon
                points_j = np.roll(points_i, -1, axis=0)
                points_k = np.roll(points_i, 1, axis=0)
                normal_ij = np.stack((points_j[:, 1] - points_i[:, 1], points_i[:, 0] - points_j[:, 0]), axis=1)
                normal_ik = np.stack((points_i[:, 1] - points_k[:, 1], points_k[:, 0] - points_i[:, 0]), axis=1)
                length_ij = np.linalg.norm(normal_ij, axis=1)
                length_ik = np.linalg.norm(normal_ik, axis=1)
                normal_ij /= np.stack((length_ij, length_ij), axis=1)
                normal_ik /= np.stack((length_ik, length_ik), axis=1)
                if clockwise:
                    normal_ij = -1 * normal_ij
                    normal_ik = -1 * normal_ik
                polygon = points_i - delta * normal_ij - delta * normal_ik

                point_array = np.arange(point_count)
                edges = np.transpose(np.stack((point_array, np.roll(point_array, 1))))
                triangles = triangle.triangulate(dict(vertices=polygon, segments=edges), opts="p")
                if "triangles" not in triangles:
                    triangles["triangles"] = []
                polygons[index] = (polygon, triangles, clockwise)

            zmin = float(layerstack[layer_number]["zmin"])
            zmax = float(layerstack[layer_number]["zmax"])
            layer_name = str(layerstack[layer_number]["name"])
            node_name = f"{cell.name}_{layer_name}"

            gltf_positions = []
            gltf_indices = []
            indices_offset = 0
            for _, poly_data, clockwise in polygons:
                if len(poly_data["vertices"]) == 0:
                    continue

                positions_top = np.insert(poly_data["vertices"], 2, zmax, axis=1)
                positions_bottom = np.insert(poly_data["vertices"], 2, zmin, axis=1)
                positions = np.concatenate((positions_top, positions_bottom))
                indices_top = poly_data["triangles"]
                indices_bottom = np.flip((indices_top + len(positions_top)), axis=1)
                ind_list_top = np.arange(len(positions_top))
                ind_list_bottom = np.arange(len(positions_top)) + len(positions_top)

                if clockwise:
                    ind_list_top = np.flip(ind_list_top, axis=0)
                    ind_list_bottom = np.flip(ind_list_bottom, axis=0)

                indices_right = np.stack(
                    (ind_list_bottom, np.roll(ind_list_bottom, -1, axis=0), np.roll(ind_list_top, -1, axis=0)),
                    axis=1,
                )
                indices_left = np.stack(
                    (np.roll(ind_list_top, -1, axis=0), ind_list_top, ind_list_bottom),
                    axis=1,
                )
                indices = np.concatenate((indices_top, indices_bottom, indices_right, indices_left))

                gltf_positions = positions if len(gltf_positions) == 0 else np.append(gltf_positions, positions, axis=0)
                gltf_indices = indices if len(gltf_indices) == 0 else np.append(
                    gltf_indices, indices + indices_offset, axis=0
                )
                indices_offset += len(positions)

            if len(gltf_positions) == 0 or len(gltf_indices) == 0:
                continue

            indices_binary_blob = gltf_indices.astype(np.uint32).flatten().tobytes()
            positions_binary_blob = gltf_positions.astype(np.float32).tobytes()

            gltf.bufferViews.append(
                pygltflib.BufferView(
                    buffer=0,
                    byteOffset=len(binary_blob),
                    byteLength=len(indices_binary_blob),
                    target=pygltflib.ELEMENT_ARRAY_BUFFER,
                )
            )
            gltf.accessors.append(
                pygltflib.Accessor(
                    bufferView=len(gltf.bufferViews) - 1,
                    byteOffset=0,
                    componentType=pygltflib.UNSIGNED_INT,
                    type=pygltflib.SCALAR,
                    count=gltf_indices.size,
                    max=[int(gltf_indices.max())],
                    min=[int(gltf_indices.min())],
                )
            )
            binary_blob += indices_binary_blob

            gltf.bufferViews.append(
                pygltflib.BufferView(
                    buffer=0,
                    byteOffset=len(binary_blob),
                    byteLength=len(positions_binary_blob),
                    target=pygltflib.ARRAY_BUFFER,
                )
            )
            gltf.accessors.append(
                pygltflib.Accessor(
                    bufferView=len(gltf.bufferViews) - 1,
                    byteOffset=0,
                    componentType=pygltflib.FLOAT,
                    count=len(gltf_positions),
                    type=pygltflib.VEC3,
                    max=gltf_positions.max(axis=0).tolist(),
                    min=gltf_positions.min(axis=0).tolist(),
                )
            )
            binary_blob += positions_binary_blob

            primitive = pygltflib.Primitive()
            primitive.indices = len(gltf.accessors) - 2
            primitive.attributes = pygltflib.Attributes(POSITION=len(gltf.accessors) - 1)
            primitive.material = list(layerstack).index(layer_number)

            mesh = pygltflib.Mesh(primitives=[primitive])
            gltf.meshes.append(mesh)
            meshes_lib[node_name] = len(gltf.meshes) - 1

    gltf.set_binary_blob(binary_blob)
    buffer.byteLength = len(binary_blob)
    gltf.convert_buffers(BufferFormat.DATAURI)

    main_cell = gdsii.top_level()[0]
    root_node = pygltflib.Node(name=main_cell.name, children=[])
    gltf.nodes.append(root_node)

    def add_cell_node(cell: gdspy.Cell, parent_node: pygltflib.Node) -> None:
        for ref in cell.references:
            instance_node = pygltflib.Node(children=[])
            properties = getattr(ref, "properties", {}) or {}
            instance_node.extras = {"type": ref.ref_cell.name}
            instance_node.name = properties.get(61, ref.ref_cell.name)
            instance_node.translation = [ref.origin[0], ref.origin[1], 0]

            rotation = getattr(ref, "rotation", None)
            if rotation is not None:
                if rotation == 90:
                    instance_node.rotation = [0, 0, 0.7071068, 0.7071068]
                elif rotation == 180:
                    instance_node.rotation = [0, 0, 1, 0]
                elif rotation == 270:
                    instance_node.rotation = [0, 0, 0.7071068, -0.7071068]

            if getattr(ref, "x_reflection", False):
                instance_node.scale = [1, -1, 1]

            for layer in layerstack.values():
                lib_name = f"{ref.ref_cell.name}_{layer['name']}"
                if lib_name in meshes_lib:
                    layer_node = pygltflib.Node(name=lib_name, mesh=meshes_lib[lib_name])
                    gltf.nodes.append(layer_node)
                    instance_node.children.append(len(gltf.nodes) - 1)

            if len(ref.ref_cell.references) > 0:
                add_cell_node(ref.ref_cell, instance_node)

            gltf.nodes.append(instance_node)
            if parent_node.children is None:
                parent_node.children = []
            parent_node.children.append(len(gltf.nodes) - 1)

    add_cell_node(main_cell, root_node)

    for layer in layerstack.values():
        lib_name = f"{main_cell.name}_{layer['name']}"
        if lib_name in meshes_lib:
            layer_node = pygltflib.Node(name=lib_name, mesh=meshes_lib[lib_name])
            gltf.nodes.append(layer_node)
            root_node.children.append(len(gltf.nodes) - 1)

    scene.nodes.append(0)
    gltf.scene = 0

    output_path.parent.mkdir(parents=True, exist_ok=True)
    gltf.save(str(output_path))
    return output_path
