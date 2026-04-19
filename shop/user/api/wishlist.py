from flask import request, jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from shop.extensions import db
from shop.models import User, Product, Wishlist
from shop.utils.api_response import error_response
from shop.seller.api.helpers import serialize_seller_product

def toggle_wishlist_action():
    try:
        verify_jwt_in_request()
        user = User.query.filter_by(uuid=get_jwt().get("user_uuid")).first()
        product_uuid = (request.get_json() or {}).get('product_uuid')

        if not product_uuid: 
            return error_response("Product UUID required", 400)
            
        product = Product.query.filter_by(uuid=product_uuid, is_active=True).first()
        if not product: 
            return error_response("Product not found", 404)

        # 🔥 Soft Delete / Reactivate Logic
        existing = Wishlist.query.filter_by(user_id=user.id, product_id=product.id).first()
        
        if existing:
            # Agar pehle se hai toh uski is_active status ko ulta kar do (Toggle)
            existing.is_active = not existing.is_active
            msg = "Added to wishlist" if existing.is_active else "Removed from wishlist"
        else:
            # Naya record
            new_wish = Wishlist(user_id=user.id, product_id=product.id, is_active=True, created_by=user.id)
            db.session.add(new_wish)
            msg = "Added to wishlist"
            
        db.session.commit()

        return jsonify({
            "success": True, 
            "message": msg,
            "data": {"is_wishlisted": existing.is_active if existing else True}
        }), 200
    except Exception as e:
        db.session.rollback()
        return error_response(str(e), 500)

def get_wishlist_action():
    try:
        verify_jwt_in_request()
        user = User.query.filter_by(uuid=get_jwt().get("user_uuid")).first()

        # 🔥 Sirf wo wishlist item lao jo active hain
        wishlist_items = Wishlist.query.filter_by(user_id=user.id, is_active=True).all()
        
        result = []
        for item in wishlist_items:
            # Table relationship use karke product data nikalo
            product = Product.query.get(item.product_id)
            if product and product.is_active:
                result.append(serialize_seller_product(product))

        return jsonify({
            "success": True, 
            "total": len(result),
            "data": result
        }), 200
    except Exception as e:
        return error_response(str(e), 500)