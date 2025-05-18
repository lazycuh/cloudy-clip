package com.cloudyclip;

import org.teavm.jso.JSExport;

import java.awt.*;
import java.awt.datatransfer.DataFlavor;
import java.awt.datatransfer.Transferable;
import java.awt.datatransfer.UnsupportedFlavorException;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Base64;
import javax.imageio.ImageIO;

/**
 * Utility class for fetching the current clipboard contents.
 */
public class Clipboard {
  /**
   * Returns the most recent clipboard item.
   * If the clipboard contains text, {@code text} will be non-null.
   * If it contains an image, {@code imageDataUrl} will be a Data URL
   * ("data:image/png;base64,...").
   *
   * @return a ClipboardItem holding text and/or image Data URL
   * @throws UnsupportedFlavorException if an unsupported flavor is requested
   * @throws IOException if an I/O error occurs during image encoding
   */
  @JSExport
  public static ClipboardItem getLatestClipboardItem() throws UnsupportedFlavorException, IOException {
    java.awt.datatransfer.Clipboard clipboard = Toolkit.getDefaultToolkit().getSystemClipboard();
    Transferable contents = clipboard.getContents(null);

    String text = null;
    String imageDataUrl = null;

    if (contents != null) {
      // 1) Try text
      if (contents.isDataFlavorSupported(DataFlavor.stringFlavor)) {
        text = (String) contents.getTransferData(DataFlavor.stringFlavor);
      }

      // 2) Try image
      if (contents.isDataFlavorSupported(DataFlavor.imageFlavor)) {
        Image img = (Image) contents.getTransferData(DataFlavor.imageFlavor);
        BufferedImage buffered = toBufferedImage(img);

        // Encode to PNG in-memory
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(buffered, "png", baos);
        String base64 = Base64.getEncoder().encodeToString(baos.toByteArray());

        // Build Data URL
        imageDataUrl = "data:image/png;base64," + base64;
      }
    }

    return new ClipboardItem(text, imageDataUrl);
  }

  // Helper to convert any AWT Image into a BufferedImage
  private static BufferedImage toBufferedImage(Image img) {
    if (img instanceof BufferedImage) {
      return (BufferedImage) img;
    }
    BufferedImage bimage = new BufferedImage(
      img.getWidth(null), img.getHeight(null),
      BufferedImage.TYPE_INT_ARGB
    );
    Graphics2D g = bimage.createGraphics();
    g.drawImage(img, 0, 0, null);
    g.dispose();
    return bimage;
  }
}
