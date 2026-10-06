// Hook resolve cho `node --test`: mã nguồn Next.js import tương đối không có đuôi ("./fees"), còn Node chỉ chạy
// được file .ts khi đường dẫn có đuôi. Chỉ thêm ".ts" khi Node không tìm thấy file như đã viết.
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (error) {
    if (/^\.{1,2}\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier)) return next(`${specifier}.ts`, context);
    throw error;
  }
}
