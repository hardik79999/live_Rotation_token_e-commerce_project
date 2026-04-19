from flask_jwt_extended import verify_jwt_in_request, get_jwt
from shop.models import Category, SellerCategory, User
from shop.utils.api_response import error_response, success_response

def get_categories_action():
    try:
        verify_jwt_in_request()
        claims = get_jwt()
        if claims.get("role") != "seller":
            return error_response("Seller access required", 403)

        seller = User.query.filter_by(uuid=claims.get("user_uuid")).first()
        if not seller:
            return error_response("Seller not found", 404)

        all_categories = Category.query.filter_by(is_active=True).all()
        seller_categories = SellerCategory.query.filter_by(seller_id=seller.id, is_active=True).all()

        sc_map = {sc.category_id: {'is_approved': sc.is_approved, 'request_uuid': sc.uuid} for sc in seller_categories}

        result = []
        for category in all_categories:
            data = {'uuid': category.uuid, 'name': category.name, 'description': category.description}
            if category.id in sc_map:
                data['status'] = 'approved' if sc_map[category.id]['is_approved'] else 'pending'
                data['request_uuid'] = sc_map[category.id]['request_uuid']
            else:
                data['status'] = 'available'
            result.append(data)

        return success_response(
            message="Seller categories fetched successfully",
            data=result,
            status_code=200,
            total_categories=len(result),
        )
    except Exception as e:
        return error_response(str(e), 500)
