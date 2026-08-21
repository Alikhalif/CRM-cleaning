import sys, pypdfium2 as pdfium
def png(pdf, out, scale=2.0):
    doc = pdfium.PdfDocument(pdf)
    img = doc[0].render(scale=scale).to_pil()
    img.save(out)
    print("rendered", out, img.size)
if __name__ == "__main__":
    png(sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv)>3 else 2.0)
