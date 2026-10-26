
function makeEventProductList(data, div_event) 
{
	var prodouct = "";
	
	//div_product display none
	var addStyleNone ="";
	var addClassDiv ="";
	if(div_event == "굿즈") 
	{
		addStyleNone = " style ='display:none' ";
		addClassDiv = "div_product";
	}
	
	for (var i = 0; i < data.length; i++) 
	{
		//다권종 체크
		var selectStyle, selectClass;
		if(div_event=="선호도") //선호도 상품수량 체크x
		{
			selectStyle ="";
			selectClass ="go_cart";			
		}
		else if(data[i].eventDetailList.length > 1)
		{
			selectStyle = "z-index:-999;opacity:0";
			selectClass = "layerpopup";
		}
		else  
		{
			selectStyle ="";
			selectClass ="go_cart";
		}
		
		//가장할인율 높은 상품 체크
		var discountTop = data[i].eventDetailList[0].discount; 
		var discountNext = 0;
		var topDiscountDetail = 0;
		/*for (var j = 0; j < data[i].eventDetailList.length; j++) 
		{
			if(j+1 < data[i].eventDetailList.length)
			{ 
				discountNext = data[i].eventDetailList[j+1].discount;
				if(discountTop-0 < discountNext-0) 
				{
					topDiscountDetail = j+1;
					discountTop = discountNext;
				}
				else topDiscountDetail = j;				
			}
		}*/
		
		//상품권종들의 시작일 종료일로 유효기간 만들기 - 오류보고 61702
		var startDate = null; // 유효기간표기용
		var endDate = null; // 유효기간표기용
		//console.log(data[i].startDiv + '/' + data[i].startDate + '/' + data[i].endDate + '/' + data[i].endDate);
		//console.log(data[i]);
		if(data[i].startDiv == 0) // 저장된값이 구매일인 경우
	    {
			startDate = data[i].startDate;
		}
		else // 구매일이 아닌경우 
		{
			data[i].eventDetailList.forEach(function(eventDetail) {
				if(eventDetail.start_div != "구매일")
				{
					if(startDate == null) startDate = eventDetail.start_date;
					else
					{
						var date1 = new Date(startDate); // 기존 날짜
						var date2 = new Date(eventDetail.start_date); // 비교해보자하는 날짜
						if(date1 > date2) // 기존날짜보다 빠른날일경우
						{
							startDate = eventDetail.start_date;
						}
					}
				}
			});
		}
		
		if(data[i].endDiv == 0) // 저장된값이 구매일인 경우
	    {
			endDate = data[i].endDate;
		}
		else // 구매일이 아닌경우 
		{
			data[i].eventDetailList.forEach(function(eventDetail) {
				if(eventDetail.end_div != "구매일")
				{
					if(endDate == null) endDate = eventDetail.end_date;
					else
					{
						var date1 = new Date(endDate); // 기존 날짜
						var date2 = new Date(eventDetail.end_date); // 비교해보자하는 날짜
						if(date1 < date2) // 기존날짜보다 나중날일경우
						{
							endDate = eventDetail.end_date;
						}
					}
				}
			});
		}
		
		prodouct +=	"<div class='contents_section_wrap' data-no='p"+i+"'>";
		prodouct +=	"	<div class='normal-box'>";
							if(div_event == "굿즈")
							{
		prodouct +=	"		<div class='normal-box-01 clearfix'	onclick='goodsSubmit()'>";						
							}
							else
							{
		prodouct +=	"		<div class='normal-box-01 clearfix'	onclick='productSubmit(" + data[i].idx_eventProduct + ")'>";
							}
		prodouct +=	"			<div>";
									if(data[i].bestproduct_path == null)
									{							
		prodouct +=	"					<img src='images/none-img.jpg' class='normal-img'>";
									}
									else if (data[i].bestproduct_path != null)
									{
		prodouct +=	"					<img src='"+svrLoc+"/" + data[i].bestproduct_path + "' class='normal-img'>";	
									}
									if(div_event == "굿즈"){}
									else
									{
										if(endDate!=="구매후0일")//장대은 오류보고 62218 추가 날짜선택안할때 분기처리 추가
										{										
		prodouct +=	"						<span class='tip_txt'>";
		prodouct +=	"							<span class='tip_terms'>유효기간 : </span>";
		//prodouct +=	"							<span class='tip_dates'>" + data[i].eventDetailList[topDiscountDetail].start_date + " ~ " + data[i].eventDetailList[topDiscountDetail].end_date + "</span>";
		prodouct +=	"							<span class='tip_dates'>" + startDate + " ~ " + endDate + "</span>";
		prodouct +=	"						</span>";
										}
										else
										{
		prodouct +=	"						<div style='border-bottom:1px solid black;height:25px;' class='proBorder'></div>";	
										}
									}
		prodouct +=	"			</div>";
		prodouct +=	"		</div>";
		
		prodouct +=	"		<div class='section_text " + addClassDiv + "' >";
							// 20221028 김서연 광고상품을 사용표기(하단 티켓라벨)쪽으로 옮김 61304
							if(data[i].ticket_type == "종이티켓") // && data[i].marketing_chk != "Y")
							{
		prodouct +=	"           <img src='images/ticket_paper.jpg'>";								
							}
							else if(data[i].ticket_type == "모바일티켓") // && data[i].marketing_chk != "Y")
							{
		prodouct +=	"           <img src='images/ticket_mobile.jpg'>";
							}
							else if(data[i].ticket_type == "택배상품") // && data[i].marketing_chk != "Y")
							{
		prodouct +=	"           <img src='images/ticket_delivery.jpg'>";								
							}
							else if(data[i].ticket_type == "직접수령") // && data[i].marketing_chk != "Y")
							{
		prodouct +=	"           <img src='images/ticket_store.png'>";
							}
							/*else if(data[i].marketing_chk == "Y")
							{
        prodouct +=	"			<img src='images/main_marketing_btn.jpg'>";
							}*/
		prodouct +=	"			";
		prodouct +=	"			<!-- 티켓라벨 -->";
							if(data[i].ticket_div == "바로 사용가능") // && data[i].marketing_chk != "Y")
							{
        prodouct +=	"			<img src='images/now_ok.jpg' class='now_ok' " + addStyleNone +  ">";
							}
							else if(data[i].ticket_div == "바로 사용불가") // && data[i].marketing_chk != "Y")
							{
        prodouct +=	"			<img src='images/now_no.jpg' class='now_ok' " + addStyleNone +  ">";
							}
							else if(data[i].ticket_div == "예약필수") // && data[i].marketing_chk != "Y")
							{
		prodouct +=	"			<img src='images/now_reservation.png' class='now_ok' " + addStyleNone +  ">";
							}
							else if(data[i].ticket_div == "수령 후 사용 가능") // && data[i].marketing_chk != "Y")
							{
		prodouct +=	"			<img src='images/after_ok.png' class='now_ok' " + addStyleNone +  ">";
							}
							//20221028 김서연 광고상품을 사용표기(티켓라벨)쪽으로 옮김 61304
							else if(data[i].ticket_div == "광고상품") // && data[i].marketing_chk == "Y")
							{
        prodouct +=	"			<img src='images/main_marketing_btn.jpg'>";
							}
							//
		prodouct +=	"			<img src='images/products_line.jpg' class='products_line'>";							
		prodouct +=	"		    <p class='txt01'>" + data[i].sale_exp + "</p>";
		prodouct +=	"		    <p class='txt02'>" + data[i].product_name + "</p>";
		prodouct +=	"		    <span class='pr_box clearfix' >";
								//console.log(i,data[i].show_div);
								if(data[i].show_div == "ALL")
								{
		prodouct +=	"				<strong class='percent' " + addStyleNone +  ">"+ data[i].eventDetailList[topDiscountDetail].discount +"<span>%</span></strong>";
		prodouct +=	"				<span class='pr_price' " + addStyleNone +  ">" + comma(data[i].eventDetailList[topDiscountDetail].normal_price) + "원</span><br>";
									if(data[i].marketing_chk == "Y"){} // 광고형상품
									else if(div_event == "굿즈")// 굿즈
									{
		prodouct +=	"					<div class='cart_basket'>";
		prodouct +=	"						<div id='#layer2' class='" + selectClass + " cart_btn_goods' onclick='goodsSubmit()' style='font-size:11pt'>";
		prodouct += "       					<p class='cart_txt'>주소입력하기</p>"; // 모바일 장바구니 추가
		prodouct +=	"						</div>";
		prodouct +=	"					</div>";
									}
									else //일반상품
									{
		prodouct +=	"					<div class='cart_basket'>";
		prodouct +=	"						<div id='#layer2' class='" + selectClass + "'";
		prodouct +=	"							data-product_name='" + data[i].product_name + "'";
		prodouct +=	"							data-idx_eventDetail='" + data[i].eventDetailList[topDiscountDetail].idx_eventDetail + "'";
		prodouct +=	"							data-idx_eventProduct='" + data[i].idx_eventProduct + "'";
		prodouct +=	"							data-idx_productDetail='" + data[i].eventDetailList[topDiscountDetail].idx_productDetail + "'";
		prodouct +=	"							data-ticket_type='" + data[i].ticket_type + "'";
		prodouct +=	"							data-cnt='" + i + "'";
		prodouct +=	"							data-img='" + data[i].thumbnail_file1 + "'";
		prodouct +=	"							data-contents='" + data[i].contents + "'";
		prodouct +=	"							data-option='" + data[i].eventDetailList[topDiscountDetail].option + "'";
		prodouct +=	"							data-class='.normal-img' >";
										if(data[i].calendar_chk === "사용안함")//오류보고 62232 장대은 추가
												{
		prodouct += "       						<img src='images/cart_basket_m.png' class='cart_basket_mn'>"; // 모바일 장바구니 추가		
												}
		prodouct +=	"						</div>";
		prodouct +=	"					</div>";					
									}
		prodouct +=	"				<span class='price' " + addStyleNone +  ">" + comma(data[i].eventDetailList[topDiscountDetail].sale_price) + "원</span>";
		prodouct +=	"				<p class='txt03' " + addStyleNone +  ">[" + data[i].eventDetailList[topDiscountDetail].option_standard + " 기준]</p>";
								}
								else
								{
		prodouct +=	"				<strong class='percent' " + addStyleNone +  ">&nbsp;</strong>";
		prodouct +=	"				<span class='' " + addStyleNone +  ">&nbsp;</span><br>";
									if(data[i].show_div == "NONE")
									{
		prodouct +=	"				<span class='price' " + addStyleNone +  ">&nbsp;</span>";
		prodouct +=	"				<p class='txt03' " + addStyleNone +  ">&nbsp;</p>";
									}
									else
									{
		prodouct +=	"				<span class='price' " + addStyleNone +  ">" + comma(data[i].eventDetailList[topDiscountDetail].sale_price) + "원</span>";
		prodouct +=	"				<p class='txt03' " + addStyleNone +  ">[" + data[i].eventDetailList[topDiscountDetail].option_standard + " 기준]</p>";
									}
								}
		prodouct +=	"			</span>";
							if(div_event == "선호도")
							{
		prodouct +=	"			<div class='btn_area'>";							
		prodouct +=	"				<div id='#layer2' class='" + selectClass + " cart_btn '";
		prodouct +=	"					data-product_name='" + data[i].product_name + "'";
		prodouct +=	"					data-idx_eventDetail='" + data[i].eventDetailList[topDiscountDetail].idx_eventDetail + "'";
		prodouct +=	"					data-idx_eventProduct='" + data[i].idx_eventProduct + "'";
		prodouct +=	"					data-idx_productDetail='" + data[i].eventDetailList[topDiscountDetail].idx_productDetail + "'";
		prodouct +=	"					data-ticket_type='" + data[i].ticket_type + "'";
		prodouct +=	"					data-cnt='" + i + "'";
		prodouct +=	"					data-img='" + data[i].thumbnail_file1 + "'";
		prodouct +=	"					data-contents='" + data[i].contents + "'";
		prodouct +=	"					data-option='" + data[i].eventDetailList[topDiscountDetail].option + "'";
		prodouct +=	"					data-class='.normal-img' >";
		prodouct +=	"						<img src='images/main_cart_btn.png' class='main_cart_img'>";
		prodouct +=	"						<p class='cart_txt'>선택</p>";
		prodouct +=	"				</div>";
		prodouct +=	"			</div>";
							}
							if(data[i].marketing_chk == "Y") // 광고상품
							{
		prodouct +=	"			<div class='btn_area'>";
		prodouct +=	"				<div id='#layer2' class='" + selectClass + " cart_btn ' onclick='productSubmit(" + data[i].idx_eventProduct + ")' style='width: 170;' >>";
		prodouct +=	"						<p class='cart_txt'>구매하기</p>";
		prodouct +=	"				</div>";
		prodouct +=	"			</div>";
							}
							else if(data[i].calendar_chk != "사용안함")//
							{
		prodouct +=	"			<div class='btn_area'>";
		prodouct +=	"				<div id='#layer2' class='" + selectClass + " cart_btn ' onclick='productSubmit(" + data[i].idx_eventProduct + ")'>";
		prodouct += "					<div class='click_cart'>";
		prodouct +=	"						<img src='images/main_cart_btn.png' class='main_cart_img'>";
		prodouct +=	"						<p class='cart_txt'>장바구니</p>";
		prodouct +=	"					</div>";
		prodouct +=	"				</div>";
		prodouct +=	"			</div>";					
							}
							else if(div_event == "굿즈")// 굿즈
							{
		prodouct +=	"			<div class='btn_area'>";
		prodouct +=	"				<div id='#layer2' class='" + selectClass + " cart_btn ' onclick='goodsSubmit()'>";
		prodouct +=	"						<p class='cart_txt'>주소입력하기</p>";
		prodouct +=	"				</div>";
		prodouct +=	"			</div>";					
							}
							else //일반상품
							{					
		prodouct +=	"			<div class='btn_area'>";							
		prodouct +=	"				<select id='opt_cnt_" + data[i].eventDetailList[topDiscountDetail].idx_eventDetail + "' class='selector' style='" + selectStyle +"' >";
		prodouct +=	"					<option>" + (1*data[i].eventDetailList[topDiscountDetail].min_ticket_unit) + "</option>";
		prodouct +=	"					<option>" + (2*data[i].eventDetailList[topDiscountDetail].min_ticket_unit) + "</option>";
		prodouct +=	"					<option>" + (3*data[i].eventDetailList[topDiscountDetail].min_ticket_unit) + "</option>";
		prodouct +=	"					<option>" + (4*data[i].eventDetailList[topDiscountDetail].min_ticket_unit) + "</option>";
		prodouct +=	"					<option>" + (5*data[i].eventDetailList[topDiscountDetail].min_ticket_unit) + "</option>";
		prodouct +=	"					<option>" + (6*data[i].eventDetailList[topDiscountDetail].min_ticket_unit) + "</option>";
		prodouct +=	"					<option>" + (7*data[i].eventDetailList[topDiscountDetail].min_ticket_unit) + "</option>";
		prodouct +=	"					<option>" + (8*data[i].eventDetailList[topDiscountDetail].min_ticket_unit) + "</option>";
		prodouct +=	"					<option>" + (9*data[i].eventDetailList[topDiscountDetail].min_ticket_unit) + "</option>";
		prodouct +=	"					<option>" + (10*data[i].eventDetailList[topDiscountDetail].min_ticket_unit) + "</option>";
		prodouct +=	"				</select>";
		prodouct +=	"				<div id='#layer2' class='" + selectClass + " cart_btn '";
		prodouct +=	"					data-product_name='" + data[i].product_name + "'";
		prodouct +=	"					data-idx_eventDetail='" + data[i].eventDetailList[topDiscountDetail].idx_eventDetail + "'";
		prodouct +=	"					data-idx_eventProduct='" + data[i].idx_eventProduct + "'";
		prodouct +=	"					data-idx_productDetail='" + data[i].eventDetailList[topDiscountDetail].idx_productDetail + "'";
		prodouct +=	"					data-min_ticket_unit='" + data[i].eventDetailList[topDiscountDetail].min_ticket_unit + "'";
		prodouct +=	"					data-ticket_type='" + data[i].ticket_type + "'";
		prodouct +=	"					data-cnt='" + i + "'";
		prodouct +=	"					data-img='" + data[i].thumbnail_file1 + "'";
		prodouct +=	"					data-contents='" + data[i].contents + "'";
		prodouct +=	"					data-option='" + data[i].eventDetailList[topDiscountDetail].option + "'";
		prodouct +=	"					data-class='.normal-img' >";
		prodouct += "					<div class='click_cart'>";
		prodouct +=	"						<img src='images/main_cart_btn.png' class='main_cart_img'>";
		prodouct +=	"						<p class='cart_txt'>장바구니</p>";
		prodouct +=	"					</div>";
		prodouct +=	"				</div>";
		prodouct +=	"			</div>";
							}
		prodouct +=	"		</div>";
		prodouct +=	"	</div>";
		prodouct +=	"</div>";
		
	}			
	
	$('#productListBox').html(prodouct);
	
	//광고 삭제 추가
	if(data.length<=3)
	{
		$('#addImage').hide();
	}
	else 
	{
		$('#addImage').show();
	}
}

//콤마찍기
function comma(str) {
    str = String(str);
    return str.replace(/(\d)(?=(?:\d{3})+(?!\d))/g, '$1,');
}