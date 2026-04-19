from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt
from flask_jwt_extended.exceptions import JWTExtendedException
from shop.extensions import db
from shop.models import User, Order, OrderStatus, Product, Payment, PaymentStatus, OrderItem
from shop.utils.api_response import error_response
from sqlalchemy import func


def admin_dashboard_action():
    # ── Auth check (separate try so JWT errors return 401 not 500) ────────
    try:
        verify_jwt_in_request()
    except JWTExtendedException as e:
        return error_response(str(e), 401)
    except Exception:
        return error_response("Authentication error", 401)

    if get_jwt().get("role") != "admin":
        return error_response("Unauthorized Access", 403)

    try:
        total_users    = User.query.filter_by(is_active=True).count()
        total_products = Product.query.filter_by(is_active=True).count()
        total_orders   = Order.query.count()

        # ── Revenue: sum of all COMPLETED payments ────────────────────────
        # Use .value to compare enum correctly with SQLAlchemy
        revenue_result = (
            db.session.query(func.sum(Payment.amount))
            .filter(Payment.status == PaymentStatus.completed)
            .scalar()
        )
        total_revenue = round(float(revenue_result or 0), 2)

        # ── Order breakdown by status ─────────────────────────────────────
        order_status_counts = {}
        for status in OrderStatus:
            count = Order.query.filter_by(status=status).count()
            order_status_counts[status.value] = count

        # ── Recent orders (last 5) with product thumbnails ──────────────────
        recent_orders = (
            Order.query
            .order_by(Order.created_at.desc())
            .limit(5)
            .all()
        )
        recent_orders_data = []
        for o in recent_orders:
            # Collect first image from each order item
            items_preview = []
            for item in o.items[:4]:   # max 4 thumbnails
                product = item.product
                if not product:
                    continue
                img = next(
                    (i.image_url for i in product.images if i.is_primary and i.is_active),
                    next((i.image_url for i in product.images if i.is_active), None)
                )
                items_preview.append({
                    "product_uuid": product.uuid,
                    "product_name": product.name,
                    "quantity":     item.quantity,
                    "image":        img,
                })

            recent_orders_data.append({
                "uuid":           o.uuid,
                "amount":         float(o.total_amount),
                "status":         o.status.value if hasattr(o.status, 'value') else str(o.status),
                "payment_method": o.payment_method.value if o.payment_method and hasattr(o.payment_method, 'value') else str(o.payment_method),
                "date":           o.created_at.strftime('%Y-%m-%d %H:%M:%S') if o.created_at else None,
                "items_preview":  items_preview,
            })

        # ── Top selling products (by quantity sold) ───────────────────────
        top_products = (
            db.session.query(
                Product.name,
                Product.uuid,
                func.sum(OrderItem.quantity).label('total_sold'),
                func.sum(OrderItem.price_at_purchase * OrderItem.quantity).label('total_revenue'),
            )
            .join(OrderItem, OrderItem.product_id == Product.id)
            .join(Order, Order.id == OrderItem.order_id)
            .filter(Order.status != OrderStatus.cancelled)
            .group_by(Product.id, Product.name, Product.uuid)
            .order_by(func.sum(OrderItem.quantity).desc())
            .limit(5)
            .all()
        )
        top_products_data = [
            {
                "name": p.name,
                "uuid": p.uuid,
                "total_sold": int(p.total_sold or 0),
                "total_revenue": round(float(p.total_revenue or 0), 2),
            }
            for p in top_products
        ]

        return jsonify({
            "success": True,
            "message": "Analytics fetched successfully",
            "data": {
                "total_users":    total_users,
                "total_products": total_products,
                "total_orders":   total_orders,
                "total_revenue":  total_revenue,
                "order_status_breakdown": order_status_counts,
                "recent_orders":  recent_orders_data,
                "top_products":   top_products_data,
            }
        }), 200

    except Exception as e:
        from flask import current_app
        current_app.logger.error(f"Dashboard error: {str(e)}")
        return error_response(str(e), 500)
