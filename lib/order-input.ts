import { z } from "zod";

/** Cart lines as the website sends them; the same shape place_order() takes. */
export const OrderItems = z
  .array(
    z.discriminatedUnion("type", [
      z.object({ type: z.literal("product"), id: z.string().uuid(), grams: z.number().int().positive(), qty: z.number().int().min(1).max(50) }),
      z.object({ type: z.literal("combo"), id: z.string().uuid(), qty: z.number().int().min(1).max(50) }),
    ]),
  )
  .min(1)
  .max(40);

export const AddressIn = z.object({
  line: z.string().min(3).max(300),
  landmark: z.string().max(200).optional(),
  lat: z.number(),
  lng: z.number(),
  place_id: z.string().optional(),
});
