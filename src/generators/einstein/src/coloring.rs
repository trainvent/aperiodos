use std::cmp::Reverse;
use std::collections::{BinaryHeap, HashMap, HashSet};

use aperiodos_render_core::Vec2;

use crate::tiling::{Label, Tile};

type Priority = Reverse<(i32, i32, usize)>;
type PointKey = (i64, i64);
type EdgeKey = (PointKey, PointKey);

pub fn four_color_indices(tiles: &[Tile]) -> Result<Vec<usize>, &'static str> {
    let adjacency = build_edge_adjacency(tiles);
    let mut colors = vec![None; tiles.len()];
    for (index, tile) in tiles.iter().enumerate() {
        if tile.label == Label::H1 {
            colors[index] = Some(3);
        }
    }

    let degrees: Vec<i32> = adjacency
        .iter()
        .map(|neighbors| {
            neighbors
                .iter()
                .filter(|neighbor| colors[**neighbor] != Some(3))
                .count() as i32
        })
        .collect();
    let mut neighbor_color_counts = vec![[0_u32; 3]; tiles.len()];
    let mut saturation = vec![0_i32; tiles.len()];
    let mut candidates = BinaryHeap::new();
    for (index, color) in colors.iter().enumerate() {
        if color.is_none() {
            candidates.push(priority(index, &saturation, &degrees));
        }
    }

    #[derive(Debug)]
    struct Frame {
        index: usize,
        choices: Vec<usize>,
        next: usize,
        applied: Option<usize>,
    }

    let Some(first) = select_candidate(&mut candidates, &colors, &saturation, &degrees) else {
        return Ok(colors.into_iter().map(|color| color.unwrap_or(3)).collect());
    };
    let mut stack = vec![Frame {
        index: first,
        choices: available_colors(first, &adjacency, &colors),
        next: 0,
        applied: None,
    }];

    loop {
        let Some(frame) = stack.last_mut() else {
            return Err("Einstein four-color solver could not find a valid coloring");
        };
        if let Some(color) = frame.applied.take() {
            update_neighbors(
                frame.index,
                color,
                false,
                &adjacency,
                &colors,
                &mut neighbor_color_counts,
                &mut saturation,
                &degrees,
                &mut candidates,
            );
            colors[frame.index] = None;
        }

        if frame.next >= frame.choices.len() {
            candidates.push(priority(frame.index, &saturation, &degrees));
            stack.pop();
            continue;
        }

        let color = frame.choices[frame.next];
        frame.next += 1;
        colors[frame.index] = Some(color);
        update_neighbors(
            frame.index,
            color,
            true,
            &adjacency,
            &colors,
            &mut neighbor_color_counts,
            &mut saturation,
            &degrees,
            &mut candidates,
        );
        frame.applied = Some(color);

        let Some(next) = select_candidate(&mut candidates, &colors, &saturation, &degrees) else {
            return Ok(colors
                .into_iter()
                .map(|color| color.expect("all tiles colored"))
                .collect());
        };
        stack.push(Frame {
            index: next,
            choices: available_colors(next, &adjacency, &colors),
            next: 0,
            applied: None,
        });
    }
}

fn priority(index: usize, saturation: &[i32], degrees: &[i32]) -> Priority {
    Reverse((-saturation[index], -degrees[index], index))
}

fn select_candidate(
    candidates: &mut BinaryHeap<Priority>,
    colors: &[Option<usize>],
    saturation: &[i32],
    degrees: &[i32],
) -> Option<usize> {
    while let Some(candidate) = candidates.pop() {
        let index = candidate.0 .2;
        if colors[index].is_none() && candidate == priority(index, saturation, degrees) {
            return Some(index);
        }
    }
    None
}

#[allow(clippy::too_many_arguments)]
fn update_neighbors(
    index: usize,
    color: usize,
    add: bool,
    adjacency: &[Vec<usize>],
    colors: &[Option<usize>],
    counts: &mut [[u32; 3]],
    saturation: &mut [i32],
    degrees: &[i32],
    candidates: &mut BinaryHeap<Priority>,
) {
    for &neighbor in &adjacency[index] {
        if colors[neighbor].is_some() {
            continue;
        }
        let previous = counts[neighbor][color];
        counts[neighbor][color] = if add { previous + 1 } else { previous - 1 };
        let current = counts[neighbor][color];
        if previous == 0 && current == 1 {
            saturation[neighbor] += 1;
        }
        if previous == 1 && current == 0 {
            saturation[neighbor] -= 1;
        }
        if (previous == 0 && current == 1) || (previous == 1 && current == 0) {
            candidates.push(priority(neighbor, saturation, degrees));
        }
    }
}

fn available_colors(
    index: usize,
    adjacency: &[Vec<usize>],
    colors: &[Option<usize>],
) -> Vec<usize> {
    let mut used = [false; 3];
    for &neighbor in &adjacency[index] {
        if let Some(color @ 0..=2) = colors[neighbor] {
            used[color] = true;
        }
    }
    (0..3).filter(|color| !used[*color]).collect()
}

pub fn build_edge_adjacency(tiles: &[Tile]) -> Vec<Vec<usize>> {
    let mut edge_map: HashMap<EdgeKey, Vec<usize>> = HashMap::new();
    for (tile_index, tile) in tiles.iter().enumerate() {
        for index in 0..tile.vertices.len() {
            let start = point_key(tile.vertices[index]);
            let end = point_key(tile.vertices[(index + 1) % tile.vertices.len()]);
            edge_map
                .entry(if start <= end {
                    (start, end)
                } else {
                    (end, start)
                })
                .or_default()
                .push(tile_index);
        }
    }
    let mut adjacency = vec![HashSet::new(); tiles.len()];
    for tile_indices in edge_map.values() {
        for (offset, &left) in tile_indices.iter().enumerate() {
            for &right in &tile_indices[offset + 1..] {
                adjacency[left].insert(right);
                adjacency[right].insert(left);
            }
        }
    }
    adjacency
        .into_iter()
        .map(|neighbors| {
            let mut neighbors: Vec<_> = neighbors.into_iter().collect();
            neighbors.sort_unstable();
            neighbors
        })
        .collect()
}

fn point_key(point: Vec2) -> (i64, i64) {
    (
        (point.x * 1_000_000.0).round() as i64,
        (point.y * 1_000_000.0).round() as i64,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tiling::generate_tiles;

    #[test]
    fn four_color_solution_keeps_special_hats_distinct_and_neighbors_apart() {
        let tiles = generate_tiles(4);
        let colors = four_color_indices(&tiles).unwrap();
        let adjacency = build_edge_adjacency(&tiles);
        for (index, tile) in tiles.iter().enumerate() {
            if tile.label == Label::H1 {
                assert_eq!(colors[index], 3);
            }
            for &neighbor in &adjacency[index] {
                if tile.label != Label::H1 && tiles[neighbor].label != Label::H1 {
                    assert_ne!(
                        colors[index], colors[neighbor],
                        "adjacent tiles {index} and {neighbor}"
                    );
                }
            }
        }
    }
}
