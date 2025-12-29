# Panduan Update Swagger Documentation

## 📋 Overview

Dokumen ini berisi panduan untuk memastikan Swagger documentation selalu terupdate setiap kali ada perubahan atau penambahan fitur di API.

## ✅ Checklist Update Swagger

Setiap kali membuat atau mengubah endpoint, pastikan checklist berikut sudah dilakukan:

### 1. Endpoint Baru
- [ ] `@ApiOperation` dengan `summary` dan `description` yang jelas
- [ ] `@ApiTags` untuk grouping endpoint
- [ ] `@ApiBearerAuth` jika memerlukan authentication
- [ ] `@ApiParam` untuk path parameters
- [ ] `@ApiQuery` untuk query parameters
- [ ] `@ApiBody` untuk request body (jika ada)
- [ ] `@ApiResponse` untuk semua kemungkinan response (200, 400, 401, 403, 404, 500, dll)
- [ ] Contoh data yang jelas di schema

### 2. Endpoint yang Diubah
- [ ] Update `@ApiOperation.description` jika behavior berubah
- [ ] Update `@ApiResponse` jika response structure berubah
- [ ] Update `@ApiQuery` atau `@ApiParam` description jika behavior berubah
- [ ] Tambahkan note jika ada breaking changes
- [ ] Update contoh data jika struktur berubah

### 3. Fitur Auto-Read (Contoh)
- [ ] Jelaskan di `@ApiOperation.description` bahwa messages otomatis ter-mark as read
- [ ] Jelaskan kondisi kapan auto-read terjadi dan kapan tidak
- [ ] Update `@ApiQuery` description untuk parameter yang mempengaruhi auto-read
- [ ] Update endpoint terkait (seperti manual read) untuk menjelaskan bahwa sekarang opsional

## 📝 Template Swagger Annotation

### Template untuk GET Endpoint

```typescript
@Get('resource/:id')
@ApiOperation({ 
  summary: 'Short summary of what this endpoint does',
  description: 'Detailed description explaining what this endpoint does, any automatic behaviors, side effects, or important notes. Example: "Get resource by ID. This endpoint automatically marks items as read when called without pagination parameters."'
})
@ApiTags('Resource')
@ApiBearerAuth('JWT-auth')
@ApiParam({ 
  name: 'id', 
  description: 'Description of the parameter' 
})
@ApiQuery({ 
  name: 'limit', 
  description: 'Description including any automatic behaviors (e.g., "If not provided, items will be automatically marked as read")', 
  required: false, 
  type: Number 
})
@ApiResponse({
  status: 200,
  description: 'Success response description',
  schema: {
    type: 'object',
    properties: {
      // Define all response properties
    },
  },
})
@ApiResponse({ status: 400, description: 'Bad request - explain when this happens' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 403, description: 'Forbidden - explain when this happens' })
@ApiResponse({ status: 404, description: 'Not found - explain when this happens' })
async getResource(@Param('id') id: string, @Query('limit') limit?: number) {
  // Implementation
}
```

### Template untuk POST Endpoint

```typescript
@Post('resource')
@ApiOperation({ 
  summary: 'Short summary',
  description: 'Detailed description including any automatic behaviors, side effects, or important notes.'
})
@ApiTags('Resource')
@ApiBearerAuth('JWT-auth')
@ApiBody({
  schema: {
    type: 'object',
    properties: {
      field1: { type: 'string', example: 'example value', description: 'Field description' },
      field2: { type: 'number', example: 123 },
    },
    required: ['field1'],
  },
})
@ApiResponse({
  status: 201,
  description: 'Success response description',
  schema: {
    type: 'object',
    properties: {
      // Define all response properties
    },
  },
})
@ApiResponse({ status: 400, description: 'Bad request - explain validation errors' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 403, description: 'Forbidden - explain when this happens' })
async createResource(@Body() body: CreateResourceDto) {
  // Implementation
}
```

### Template untuk PUT/PATCH Endpoint

```typescript
@Put('resource/:id')
@ApiOperation({ 
  summary: 'Update resource',
  description: 'Detailed description including what gets updated, any automatic behaviors, or side effects.'
})
@ApiTags('Resource')
@ApiBearerAuth('JWT-auth')
@ApiParam({ name: 'id', description: 'Resource ID' })
@ApiBody({
  schema: {
    type: 'object',
    properties: {
      // Define updateable fields
    },
  },
})
@ApiResponse({
  status: 200,
  description: 'Resource updated successfully',
  schema: {
    type: 'object',
    properties: {
      // Updated resource structure
    },
  },
})
@ApiResponse({ status: 400, description: 'Bad request' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 404, description: 'Resource not found' })
async updateResource(@Param('id') id: string, @Body() body: UpdateResourceDto) {
  // Implementation
}
```

### Template untuk DELETE Endpoint

```typescript
@Delete('resource/:id')
@ApiOperation({ 
  summary: 'Delete resource',
  description: 'Detailed description including any cascading deletes, soft deletes, or important warnings.'
})
@ApiTags('Resource')
@ApiBearerAuth('JWT-auth')
@ApiParam({ name: 'id', description: 'Resource ID' })
@ApiResponse({
  status: 200,
  description: 'Resource deleted successfully',
  schema: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string', example: 'Resource deleted' },
    },
  },
})
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 403, description: 'Forbidden' })
@ApiResponse({ status: 404, description: 'Resource not found' })
async deleteResource(@Param('id') id: string) {
  // Implementation
}
```

## 🎯 Best Practices

### 1. Deskripsi yang Jelas
- **DO**: Jelaskan apa yang endpoint lakukan, termasuk side effects
- **DO**: Jelaskan kondisi kapan auto-read, auto-update, atau behavior otomatis lainnya terjadi
- **DON'T**: Hanya menulis summary singkat tanpa detail

**Contoh Baik:**
```typescript
@ApiOperation({ 
  summary: 'Get messages in a conversation',
  description: 'Get messages in a specific conversation. Messages are automatically marked as read when this endpoint is called without the "before" parameter (first page only). When paginating with "before" parameter, messages will not be automatically marked as read.'
})
```

**Contoh Kurang Baik:**
```typescript
@ApiOperation({ summary: 'Get messages' })
```

### 2. Parameter Description
- **DO**: Jelaskan behavior khusus dari parameter (misalnya, auto-read jika tidak ada)
- **DO**: Jelaskan format yang diharapkan (ISO date, message ID, dll)
- **DON'T**: Hanya menulis nama parameter tanpa penjelasan

**Contoh Baik:**
```typescript
@ApiQuery({ 
  name: 'before', 
  description: 'Cursor for pagination (message ID). If not provided, messages will be automatically marked as read. If provided, messages will NOT be automatically marked as read (for pagination).', 
  required: false 
})
```

**Contoh Kurang Baik:**
```typescript
@ApiQuery({ name: 'before', description: 'Pagination cursor', required: false })
```

### 3. Response Documentation
- **DO**: Dokumentasikan semua kemungkinan response codes
- **DO**: Sertakan schema yang lengkap dengan contoh data
- **DO**: Jelaskan kapan setiap error code terjadi
- **DON'T**: Hanya dokumentasikan success response

**Contoh Baik:**
```typescript
@ApiResponse({
  status: 200,
  description: 'Messages retrieved successfully',
  schema: {
    type: 'object',
    properties: {
      messages: { type: 'array', items: { type: 'object' } },
      next_cursor: { type: 'string', example: '90d5ec9f5824f70015a1c004' },
      has_more: { type: 'boolean', example: true },
    },
  },
})
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 403, description: 'Not a participant in this conversation' })
@ApiResponse({ status: 404, description: 'Conversation not found' })
```

### 4. Breaking Changes
- **DO**: Tambahkan note di description jika ada breaking changes
- **DO**: Jelaskan migration path jika ada
- **DO**: Update endpoint terkait yang mungkin terpengaruh

**Contoh:**
```typescript
@ApiOperation({ 
  summary: 'Mark messages as read',
  description: 'Manually mark all messages in a conversation as read. Note: This endpoint is now optional as messages are automatically marked as read when opening a chat via GET /chat/conversations/:id/messages (without "before" parameter) or POST /chat/conversations/ensure. This endpoint is still available for special use cases.'
})
```

### 5. Auto-Behaviors
Setiap kali ada behavior otomatis (auto-read, auto-update, auto-delete, dll), pastikan:
- [ ] Dijelaskan di `@ApiOperation.description`
- [ ] Dijelaskan di parameter yang mempengaruhi behavior tersebut
- [ ] Dijelaskan kondisi kapan behavior terjadi dan kapan tidak
- [ ] Update endpoint terkait yang mungkin terpengaruh

## 🔍 Review Checklist

Sebelum commit, pastikan:

- [ ] Semua endpoint baru sudah ada Swagger annotation lengkap
- [ ] Semua endpoint yang diubah sudah update Swagger annotation
- [ ] Semua auto-behaviors sudah didokumentasikan
- [ ] Semua response codes sudah didokumentasikan
- [ ] Semua parameter sudah ada description yang jelas
- [ ] Contoh data sudah sesuai dengan struktur aktual
- [ ] Tidak ada typo atau kesalahan grammar
- [ ] Swagger UI bisa diakses dan menampilkan dokumentasi dengan benar

## 🚀 Quick Reference

### Import yang Diperlukan

```typescript
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth, 
  ApiBody, 
  ApiParam, 
  ApiQuery 
} from '@nestjs/swagger';
```

### Common Response Codes

```typescript
// Success
@ApiResponse({ status: 200, description: 'Success' })
@ApiResponse({ status: 201, description: 'Created' })

// Client Errors
@ApiResponse({ status: 400, description: 'Bad Request' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 403, description: 'Forbidden' })
@ApiResponse({ status: 404, description: 'Not Found' })
@ApiResponse({ status: 409, description: 'Conflict' })
@ApiResponse({ status: 422, description: 'Unprocessable Entity' })

// Server Errors
@ApiResponse({ status: 500, description: 'Internal Server Error' })
```

## 📚 Contoh Implementasi Lengkap

Lihat file `src/modules/chat/chat.controller.ts` untuk contoh implementasi Swagger yang lengkap dengan auto-read behavior.

## 🎯 Action Items

Setiap kali membuat PR atau commit yang mengubah API:

1. ✅ Baca checklist di atas
2. ✅ Update Swagger annotation sesuai template
3. ✅ Test di Swagger UI untuk memastikan dokumentasi benar
4. ✅ Review dengan team sebelum merge

---

**Ingat**: Dokumentasi yang baik membantu developer frontend dan mengurangi miscommunication. Invest waktu untuk dokumentasi yang jelas!

