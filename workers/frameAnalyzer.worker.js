self.onmessage = function(e) {
  const { data, pixelCount } = e.data;
  let r = 0, g = 0, b = 0;
  
  for (let i = 0; i < data.length; i += 3) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  
  const avgR = r / pixelCount;
  const avgG = g / pixelCount;
  const avgB = b / pixelCount;
  const hue = rgbToHue(avgR, avgG, avgB);
  
  self.postMessage({ hue });
};

function rgbToHue(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0;
  
  if (max !== min) {
    if (max === r) hue = ((g - b) / (max - min)) * 60;
    else if (max === g) hue = ((b - r) / (max - min)) * 60 + 120;
    else hue = ((r - g) / (max - min)) * 60 + 240;
  }
  
  return (hue + 360) % 360;
} 