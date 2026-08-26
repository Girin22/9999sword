param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$OutputPath
)

Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;

public static class TransparentBackgroundExtractor {
  private static bool IsBackdrop(Color color) {
    int min = Math.Min(color.R, Math.Min(color.G, color.B));
    int max = Math.Max(color.R, Math.Max(color.G, color.B));
    return min >= 228 && max - min <= 20;
  }

  public static void Run(string inputPath, string outputPath) {
    Bitmap source = new Bitmap(inputPath);
    try {
    int width = source.Width;
    int height = source.Height;
    var background = new bool[width * height];
    var queued = new bool[width * height];
    var queue = new Queue<int>();
    Action<int, int> seed = (x, y) => {
      int index = y * width + x;
      if (!queued[index] && IsBackdrop(source.GetPixel(x, y))) {
        queued[index] = true;
        queue.Enqueue(index);
      }
    };
    for (int x = 0; x < width; x++) { seed(x, 0); seed(x, height - 1); }
    for (int y = 0; y < height; y++) { seed(0, y); seed(width - 1, y); }
    while (queue.Count > 0) {
      int index = queue.Dequeue();
      background[index] = true;
      int x = index % width;
      int y = index / width;
      if (x > 0) seed(x - 1, y);
      if (x + 1 < width) seed(x + 1, y);
      if (y > 0) seed(x, y - 1);
      if (y + 1 < height) seed(x, y + 1);
    }
    Bitmap output = new Bitmap(width, height, PixelFormat.Format32bppArgb);
    try {
    for (int y = 0; y < height; y++) {
      for (int x = 0; x < width; x++) {
        Color color = source.GetPixel(x, y);
        output.SetPixel(x, y, background[y * width + x] ? Color.Transparent : Color.FromArgb(255, color.R, color.G, color.B));
      }
    }
    output.Save(outputPath, ImageFormat.Png);
    } finally {
      output.Dispose();
    }
    } finally {
      source.Dispose();
    }
  }
}
'@

[TransparentBackgroundExtractor]::Run((Resolve-Path -LiteralPath $InputPath).Path, $OutputPath)
