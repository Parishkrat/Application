<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Upgrade to Pro</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>

    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        background: #f2f2f2;
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
      }

      .upgrade-container {
        background: #fff;
        padding: 40px;
        border-radius: 12px;
        box-shadow: 0 0 15px rgba(0, 0, 0, 0.1);
        text-align: center;
        max-width: 400px;
        width: 90%;
      }

      h1 {
        font-size: 28px;
        color: #333;
        margin-bottom: 10px;
      }

      p {
        font-size: 16px;
        color: #555;
        margin-bottom: 30px;
      }

      #payBtn {
        padding: 12px 24px;
        font-size: 16px;
        font-weight: bold;
        color: #fff;
        background-color: #0070f3;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: background-color 0.3s ease;
      }

      #payBtn:hover {
        background-color: #0059c1;
      }
    </style>
  </head>

  <body>
    <div class="upgrade-container">
      <h1>Upgrade to Pro</h1>
      <p>₹1 for unlimited todos and editor access.</p>
      <button id="payBtn">Pay with Razorpay</button>
    </div>

    <script>
      document.getElementById("payBtn").onclick = async () => {
        try {
          const orderRes = await fetch("/payment/create-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
          const order = await orderRes.json();

          const options = {
            key: "<%= razorpayKeyId %>", // safer to inject from backend
            amount: order.amount,
            currency: order.currency,
            name: "Todo App Pro",
            description: "Pro Plan Upgrade",
            order_id: order.id,
            handler: async function (response) {
              const verifyRes = await fetch("/payment/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(response),
              });

              if (verifyRes.ok) {
                alert("Payment successful! You are now a Pro user.");
                window.location.href = "/";
              } else {
                alert("Payment verification failed.");
              }
            },
            prefill: {
              name: "<%= user.name %>",
              email: "<%= user.email %>",
            },
            theme: {
              color: "#0070f3",
            },
          };

          const rzp = new Razorpay(options);
          rzp.open();
        } catch (err) {
          console.error(err);
          alert("Payment failed. Please try again.");
        }
      };
    </script>
  </body>
</html>
