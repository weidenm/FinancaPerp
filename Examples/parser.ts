import * as pdfParse from 'pdf-parse';
import * as xlsx from 'xlsx';

export async function processFile(file: Express.Multer.File): Promise<any[]> {
    const { mimetype, buffer, originalname } = file;

    try {
        if (mimetype === 'application/pdf' || originalname.toLowerCase().endsWith('.pdf')) {
            return await processPDF(buffer);
        } else if (mimetype === 'text/csv' || originalname.toLowerCase().endsWith('.csv')) {
            return await processCSV(buffer);
        } else if (mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || originalname.toLowerCase().endsWith('.xlsx')) {
            return await processExcel(buffer);
        } else if (originalname.toLowerCase().endsWith('.ofx') || mimetype === 'application/x-ofx' || mimetype === 'application/octet-stream') {
            return await processOFX(buffer);
        } else if (mimetype === 'text/plain' || originalname.toLowerCase().endsWith('.txt')) {
            return await processText(buffer);
        } else if (mimetype.startsWith('image/')) {
            return await processImage(buffer);
        } else {
            throw new Error('UNSUPPORTED_FORMAT');
        }
    } catch (error: any) {
        console.error(`Erro ao processar arquivo ${originalname}:`, error);
        throw error;
    }
}

async function processOFX(buffer: Buffer): Promise<any[]> {
    try {
        const content = buffer.toString('utf-8');
        if (!content.includes('OFX')) throw new Error('OFX_INVALID_FORMAT');
        return [{ rawText: content, source: 'ofx' }];
    } catch (error) {
        throw new Error('OFX_INVALID_FORMAT');
    }
}

async function processPDF(buffer: Buffer): Promise<any[]> {
    try {
        const parse = (pdfParse as any).default || pdfParse;
        if (typeof parse !== 'function') {
            throw new Error('PDF parser component is not a function.');
        }
        const data = await parse(buffer);
        return [{ rawText: data.text, source: 'pdf' }];
    } catch (error: any) {
        if (error.message && error.message.toLowerCase().includes('password')) {
            throw new Error('PDF_PASSWORD_PROTECTED');
        }
        throw new Error('PDF_INVALID_FORMAT');
    }
}

async function processCSV(buffer: Buffer): Promise<any[]> {
    try {
        const content = buffer.toString('utf-8');
        return [{ rawText: content, source: 'csv' }];
    } catch (error) {
        throw new Error('FILE_READ_ERROR');
    }
}

async function processText(buffer: Buffer): Promise<any[]> {
    try {
        const content = buffer.toString('utf-8');
        return [{ rawText: content, source: 'txt' }];
    } catch (error) {
        throw new Error('FILE_READ_ERROR');
    }
}

async function processExcel(buffer: Buffer): Promise<any[]> {
    try {
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = xlsx.utils.sheet_to_json(sheet);
        return json.map((item: any) => ({ ...item, source: 'xlsx' }));
    } catch (error) {
        throw new Error('XLSX_INVALID_FORMAT');
    }
}

async function processImage(buffer: Buffer): Promise<any[]> {
    try {
        const base64 = buffer.toString('base64');
        return [{ imageBase64: base64, source: 'image' }];
    } catch (error) {
        throw new Error('FILE_READ_ERROR');
    }
}
