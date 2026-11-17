import React, { useEffect, useMemo, useState } from 'react';
import { IcNavBack, IcCart } from '../res/icons';
import { useEbayGestures } from '../navigation';
import { useEbayStrings } from '../hooks/useEbayStrings';
import { useEbayStore } from '../state';
import { loadProducts, getProductsSync } from '../data/loader';
import { showImageFallback } from '../../../os/utils/imageFallback';
import type { ProductItem } from '../types';

const CartPage: React.FC = () => {
  const { bindBack, bindTap } = useEbayGestures();
  const s = useEbayStrings();
  const cartItems = useEbayStore(state => state.cartItems);
  const removeCartItem = useEbayStore(state => state.removeCartItem);
  const [products, setProducts] = useState<ProductItem[]>(getProductsSync() ?? []);
  const [loadFailed, setLoadFailed] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    loadProducts().then(items => { if (active) { setProducts(items); setLoadFailed(false); } }).catch(() => { if (active) setLoadFailed(true); });
    return () => { active = false; };
  }, []);

  const ids = Array.isArray(cartItems) ? cartItems : [];
  const entries = useMemo(() => {
    const byId = new Map(products.map(product => [product.id, product]));
    return ids.map(id => ({ id, product: byId.get(id) }));
  }, [ids, products]);
  const subtotal = entries.reduce((sum, entry) => sum + (entry.product?.price ?? 0), 0);

  return (
    <div className="h-full bg-app-surface flex flex-col" data-status-bar-foreground="dark">
       {/* Header */}
       <div className="px-4 py-3 pt-10 flex items-center border-b border-gray-100">
          <div {...bindBack()} className="p-1 cursor-pointer mr-4">
             <IcNavBack size={24} className="text-black" />
          </div>
          <h1 className="text-xl font-bold text-black">{s.cart_title}</h1>
       </div>

       {ids.length === 0 ? (
         <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
           <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4"><IcCart size={40} className="text-gray-400" /></div>
           <h2 className="text-xl font-bold text-app-text mb-2">{s.cart_empty_title}</h2>
           <p className="text-app-text-muted mb-6">{s.cart_empty_desc}</p>
         </div>
       ) : (
         <div className="flex-1 overflow-y-auto p-4" data-scroll-container="main" data-scroll-direction="vertical">
           {entries.map(({ id, product }) => (
             <div key={id} className="mb-3 rounded-xl border border-gray-200 bg-white p-3">
               <div className="flex gap-3">
                 {product && <img src={product.image} alt="" onError={showImageFallback} className="h-20 w-20 rounded-lg object-cover" />}
                 <div className="min-w-0 flex-1">
                   {product ? <button type="button" {...bindTap('cart.item.open', { id })} className="line-clamp-2 text-left text-sm font-medium text-black">{product.title}</button> : <p className="text-sm text-gray-600">{loadFailed ? s.cart_product_unavailable : s.cart_product_loading}</p>}
                   {product && <p className="mt-2 font-bold text-black">¥{product.price.toFixed(2)}</p>}
                 </div>
               </div>
               <button type="button" data-action="cart.item.remove" data-action-params={JSON.stringify({ productId: id })} onClick={() => removeCartItem(id)} className="mt-2 text-sm text-blue-600">{s.cart_remove}</button>
             </div>
           ))}
           <div className="mt-4 flex justify-between border-t border-gray-200 pt-4 font-semibold text-black"><span>{s.cart_subtotal}</span><span>¥{subtotal.toFixed(2)}</span></div>
           <p className="mt-3 text-sm text-gray-500">{s.cart_local_notice}</p>
           <button type="button" data-action="cart.checkout.preview" disabled={entries.some(entry => !entry.product)} onClick={() => setNotice(s.cart_checkout_unavailable)} className="mt-4 w-full rounded-full bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-50">{s.cart_checkout_preview}</button>
           {notice && <p role="status" className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">{notice}</p>}
         </div>
       )}
    </div>
  );
};

export default CartPage;
