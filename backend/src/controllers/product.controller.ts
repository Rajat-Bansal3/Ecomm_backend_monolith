import type { Request, Response } from "express";
import { redis } from "../config/database";
import { productionConfig } from "../config/production";
import { Product } from "../models/product.model";
import type { AuthRequest } from "../types";
import { logger } from "../utils/logger";
import { ApiResponse } from "../utils/response";
import { catchAsync } from "../utils/response";
import { arrayChunk } from "../utils/utilFunctions";

const CACHE_TTL = 60 * 5;

export const createProduct = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const product = await Product.create({
      ...req.body,
      createdBy: req.user?._id,
    });

    await redis.del("products");

    return ApiResponse.success(
      res,
      product,
      "Product created successfully",
      201,
    );
  },
);
export const crateProductsBulk = catchAsync(
  async (req: AuthRequest, res: Response) => {
    await Promise.all([
      redis.del("products"),
      redis.del("products:categories"),
    ]);
    const productsChunk = arrayChunk(
      req.body,
      process.env.NODE_ENV === "production"
        ? productionConfig.batches.PRODUCT_CHUNK
        : 2000,
    );
    const insertPromises = productsChunk.map((chunk) => {
      const productsWithOwner = chunk.map((product: any) => ({
        ...product,
        createdBy: req.user?._id,
      }));
      return Product.insertMany(productsWithOwner, {
        ordered: false,
      });
    });
    const results = await Promise.allSettled(insertPromises);
    const processedResults = results.reduce(
      (acc, result) => {
        if (result.status === "fulfilled") {
          acc.uploaded += result.value.length;
        } else {
          if (result.reason.code === 11000) {
            acc.duplicates += 1;
          }
          acc.failed += 1;
        }
        return acc;
      },
      { uploaded: 0, failed: 0, duplicates: 0 },
    );
    logger.info(
      `Bulk product upload completed: ${JSON.stringify({
        total:
          productsChunk.length *
          (process.env.NODE_ENV === "production"
            ? productionConfig.batches.PRODUCT_CHUNK
            : 2000),
        uploaded: processedResults.uploaded,
        failed: processedResults.failed,
        duplicates: processedResults.duplicates,
      })}`,
    );
    return ApiResponse.success(res, null, "Products uploaded successfully");
  },
);

export const getProducts = catchAsync(async (req: Request, res: Response) => {
  const page = Number.parseInt(req.query.page as string) || 1;
  const limit = Number.parseInt(req.query.limit as string) || 10;
  const search = req.query.search as string;
  const category = req.query.category as string;
  const sortBy = (req.query.sortBy as string) || "createdAt";
  const order = (req.query.order as "asc" | "desc") || "desc";

  const cacheKey = `products:${page}:${limit}:${search}:${category}:${sortBy}:${order}`;

  const cachedData = await redis.get(cacheKey);
  if (cachedData) {
    return ApiResponse.success(res, JSON.parse(cachedData));
  }

  const query: any = { isActive: true };
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }
  if (category) {
    query.category = category;
  }

  const skip = (page - 1) * limit;
  const [products, total] = await Promise.all([
    Product.find(query)
      .sort({ [sortBy]: order === "asc" ? 1 : -1 })
      .skip(skip)
      .limit(limit)
      .populate("createdBy", "firstName lastName"),
    Product.countDocuments(query),
  ]);

  const data = {
    products,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };

  // Cache the results
  await redis.set(cacheKey, JSON.stringify(data), "EX", CACHE_TTL);

  return ApiResponse.success(res, data);
});

export const getProduct = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const cachedProduct = await redis.get(`product:${id}`);
  if (cachedProduct) {
    return ApiResponse.success(res, JSON.parse(cachedProduct));
  }

  const product = await Product.findById(id).populate(
    "createdBy",
    "firstName lastName",
  );

  if (!product || !product.isActive) {
    return ApiResponse.error(res, "Product not found", 404);
  }

  await redis.set(`product:${id}`, JSON.stringify(product), "EX", CACHE_TTL);

  return ApiResponse.success(res, product);
});

export const updateProduct = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return ApiResponse.error(res, "Product not found", 404);
    }

    if (
      req.user?.role !== "admin" &&
      product.createdBy?.toString() !== req.user?._id?.toString()
    ) {
      return ApiResponse.error(
        res,
        "Not authorized to update this product",
        403,
      );
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { ...req.body },
      { new: true, runValidators: true },
    );

    await Promise.all([redis.del(`product:${id}`), redis.del("products")]);

    return ApiResponse.success(
      res,
      updatedProduct,
      "Product updated successfully",
    );
  },
);

export const deleteProduct = catchAsync(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return ApiResponse.error(res, "Product not found", 404);
    }

    if (
      req.user?.role !== "admin" &&
      product.createdBy?.toString() !== req.user?._id?.toString()
    ) {
      return ApiResponse.error(
        res,
        "Not authorized to delete this product",
        403,
      );
    }

    await Product.findByIdAndUpdate(id, { isActive: false });

    await Promise.all([redis.del(`product:${id}`), redis.del("products")]);

    return ApiResponse.success(res, null, "Product deleted successfully");
  },
);

export const getProductsInfo = catchAsync(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    if (!Array.isArray(ids)) {
      return ApiResponse.error(res, "Product IDs must be an array", 400);
    }

    const cacheKey = `products:info:${ids.sort().join(",")}`;

    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return ApiResponse.success(res, JSON.parse(cachedData));
    }

    const products = await Product.find(
      { _id: { $in: ids }, isActive: true },
      "name price images stock",
    ).lean();

    const productMap = products.reduce(
      (acc, product) => {
        acc[product._id.toString()] = {
          id: product._id,
          name: product.name,
          price: product.price,
          image: product.images[0],
          stock: product.stock,
        };
        return acc;
      },
      {} as Record<string, any>,
    );

    await redis.set(cacheKey, JSON.stringify(productMap), "EX", CACHE_TTL);

    return ApiResponse.success(res, productMap);
  },
);

export const getProductCategories = catchAsync(
  async (_req: Request, res: Response) => {
    const cacheKey = "product:categories";

    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return ApiResponse.success(res, JSON.parse(cachedData));
    }

    const categories = await Product.distinct("category", { isActive: true });

    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => ({
        name: category,
        count: await Product.countDocuments({ category, isActive: true }),
      })),
    );

    await redis.set(
      cacheKey,
      JSON.stringify(categoriesWithCount),
      "EX",
      CACHE_TTL,
    );

    return ApiResponse.success(res, categoriesWithCount);
  },
);

export const getFeaturedProducts = catchAsync(
  async (_req: Request, res: Response) => {
    const cacheKey = "products:featured";

    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      return ApiResponse.success(res, JSON.parse(cachedData));
    }

    const products = await Product.find({ isActive: true, stock: { $gt: 10 } })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("name price images stock")
      .lean();

    await redis.set(cacheKey, JSON.stringify(products), "EX", CACHE_TTL);

    return ApiResponse.success(res, products);
  },
);
