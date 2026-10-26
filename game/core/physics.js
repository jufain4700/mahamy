export function collidesAt(world, x, feetY, z, radius = 0.28, height = 1.72) {
  const minX = Math.floor(x - radius);
  const maxX = Math.floor(x + radius);
  const minZ = Math.floor(z - radius);
  const maxZ = Math.floor(z + radius);
  const minY = Math.floor(feetY + 0.06);
  const maxY = Math.floor(feetY + height - 0.06);
  for (let bx = minX; bx <= maxX; bx++) {
    for (let bz = minZ; bz <= maxZ; bz++) {
      for (let by = minY; by <= maxY; by++) {
        if (world.isSolid(bx, by, bz)) return true;
      }
    }
  }
  return false;
}

export function moveAndCollide(world, player, dx, dy, dz) {
  const step = 0.13;
  const count = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / step));
  const sx = dx / count, sy = dy / count, sz = dz / count;
  let hitX = false, hitY = false, hitZ = false;
  for (let i = 0; i < count; i++) {
    if (dx && !collidesAt(world, player.x + sx, player.y, player.z)) player.x += sx;
    else if (dx) hitX = true;
    if (dy && !collidesAt(world, player.x, player.y + sy, player.z)) player.y += sy;
    else if (dy) { hitY = true; player.velocityY = 0; }
    if (dz && !collidesAt(world, player.x, player.y, player.z + sz)) player.z += sz;
    else if (dz) hitZ = true;
  }
  const grounded = collidesAt(world, player.x, player.y - 0.09, player.z);
  return { hitX, hitY, hitZ, grounded };
}
