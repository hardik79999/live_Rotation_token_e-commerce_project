from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from shop.models import Product, User
from shop.utils.api_response import error_response
from shop.seller.api.helpers import serialize_seller_product

def get_products_action():
    try:
        verify_jwt_in_request()
        claims = get_jwt()
        if claims.get("role") != "seller": return error_response("Unauthorized!", 403)

        seller = User.query.filter_by(uuid=claims.get("user_uuid")).first()
        products = Product.query.filter_by(seller_id=seller.id, is_active=True).order_by(Product.created_at.desc()).all()
        result = [serialize_seller_product(p) for p in products]
        
        return jsonify({"success": True, "message": "Products loaded.", "total_products": len(result), "data": result}), 200
    except Exception as e:
        return error_response(str(e), 500)