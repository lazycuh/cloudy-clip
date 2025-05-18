package com.cloudyclip;

import org.teavm.jso.JSExport;
import org.teavm.jso.JSProperty;

public class ClipboardItem {
  private final String text;
  private final String imageDataUrl;

  @JSExport
  public ClipboardItem(String text, String imageDataUrl) {
    this.text = text;
    this.imageDataUrl = imageDataUrl;
  }

  @JSExport
  @JSProperty
  public String getText() {
    return text;
  }

  @JSExport
  @JSProperty
  public String getImageDataUrl() {
    return imageDataUrl;
  }
}
