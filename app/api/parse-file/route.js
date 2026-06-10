import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.toLowerCase();
    let text = '';

    if (fileName.endsWith('.txt')) {
      text = buffer.toString('utf-8');
    } else if (fileName.endsWith('.pdf')) {
      const pdfModule = await import('pdf-parse');
      const PDFParseClass = pdfModule.PDFParse || (pdfModule.default && pdfModule.default.PDFParse);
      
      if (PDFParseClass) {
        await import('pdfjs-dist/legacy/build/pdf.worker.mjs');

        const parser = new PDFParseClass({ data: buffer });
        try {
          const result = await parser.getText();
          text = result.text || '';
        } finally {
          await parser.destroy();
        }
      } else {
        const pdfParseFn = pdfModule.default || pdfModule;
        if (typeof pdfParseFn === 'function') {
          const data = await pdfParseFn(buffer);
          text = data.text || '';
        } else {
          throw new Error('Could not find a valid PDF parser in pdf-parse dependency');
        }
      }
    } else if (fileName.endsWith('.docx')) {
      const mammothModule = await import('mammoth');
      const mammoth = mammothModule.default || mammothModule;
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Use .pdf, .docx, or .txt' }, { status: 400 });
    }

    return NextResponse.json({ text: text.trim() });
  } catch (error) {
    console.error('File parse error:', error);
    return NextResponse.json(
      {
        error: 'Failed to parse file',
        detail: error.message
      },
      { status: 500 }
    );
  }
}
